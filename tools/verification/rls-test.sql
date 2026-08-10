-- Vérifie l'isolation des données entre deux comptes et les règles métier clés.
\set ON_ERROR_STOP on

-- Deux utilisateurs.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@exemple.com');

\echo '--- Le déclencheur a-t-il créé les profils ?'
select count(*) as profils_crees from public.profiles;

-- ===========================================================================
-- Utilisateur A
-- ===========================================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.workspaces (user_id, name, color, position)
values ('11111111-1111-1111-1111-111111111111', 'Deepest Mind', 'violet', 0);

insert into public.stages (user_id, key, name, color, position)
values ('11111111-1111-1111-1111-111111111111', 'idee', 'Idée', 'ardoise', 0);

insert into public.tracks (user_id, workspace_id, stage_id, title, bpm)
values (
  '11111111-1111-1111-1111-111111111111',
  (select id from public.workspaces limit 1),
  (select id from public.stages limit 1),
  'Track de A',
  124
);

insert into public.labels (user_id, name, email)
values ('11111111-1111-1111-1111-111111111111', 'Label de A', 'demo@labela.com');

insert into public.label_submissions (user_id, track_id, label_id, sent_at, status)
values (
  '11111111-1111-1111-1111-111111111111',
  (select id from public.tracks limit 1),
  (select id from public.labels limit 1),
  current_date - 8,
  'envoye'
);

insert into public.track_tasks (user_id, track_id, title, category, weight, status)
values
  ('11111111-1111-1111-1111-111111111111', (select id from public.tracks limit 1), 'Kick', 'production', 3, 'terminee'),
  ('11111111-1111-1111-1111-111111111111', (select id from public.tracks limit 1), 'Bass', 'production', 1, 'a_faire'),
  ('11111111-1111-1111-1111-111111111111', (select id from public.tracks limit 1), 'Ignorée', 'production', 5, 'ignoree'),
  ('11111111-1111-1111-1111-111111111111', (select id from public.tracks limit 1), 'Teaser', 'promotion', 1, 'a_faire');

\echo '--- A voit ses données'
select count(*) as tracks_de_a from public.tracks;

\echo '--- « Répondu » est bien déduit de la date de réponse (attendu : f)'
select responded from public.label_submissions;

update public.label_submissions
set responded_at = current_date, response_type = 'positive', status = 'interesse';

\echo '--- Après saisie d''une date de réponse (attendu : t)'
select responded, response_type, status from public.label_submissions;

\echo '--- Progression production : 3 / (3+1) = 75 % (tâche ignorée exclue)'
select round(
  sum(weight) filter (where status = 'terminee')::numeric
  / nullif(sum(weight) filter (where status <> 'ignoree'), 0) * 100
) as progression_production
from public.track_tasks
where category = 'production';

-- ===========================================================================
-- Utilisateur B : ne doit rien voir de A
-- ===========================================================================
reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

\echo '--- B voit-il les tracks de A ? (attendu : 0)'
select count(*) as tracks_visibles_par_b from public.tracks;
\echo '--- B voit-il les labels de A ? (attendu : 0)'
select count(*) as labels_visibles_par_b from public.labels;
\echo '--- B voit-il les envois de A ? (attendu : 0)'
select count(*) as envois_visibles_par_b from public.label_submissions;
\echo '--- B voit-il les tâches de A ? (attendu : 0)'
select count(*) as taches_visibles_par_b from public.track_tasks;

\echo '--- B peut-il modifier la track de A ? (attendu : UPDATE 0)'
update public.tracks set title = 'Piratée' where true;

\echo '--- B peut-il supprimer la track de A ? (attendu : DELETE 0)'
delete from public.tracks where true;

\echo '--- B peut-il insérer une ligne au nom de A ? (attendu : erreur RLS)'
do $$
begin
  insert into public.tracks (user_id, title)
  values ('11111111-1111-1111-1111-111111111111', 'Injection');
  raise exception 'ÉCHEC : insertion au nom d''autrui autorisée';
exception
  when insufficient_privilege then
    raise notice 'OK : insertion au nom d''autrui refusée par la RLS';
end $$;

-- ===========================================================================
-- Retour à A : intégrité et cascades
-- ===========================================================================
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '--- La track de A est intacte'
select title from public.tracks;

\echo '--- Un doublon de relevé de résultats est-il refusé ? (attendu : erreur)'
insert into public.release_metrics (user_id, track_id, measured_on, spotify_streams)
values ('11111111-1111-1111-1111-111111111111', (select id from public.tracks limit 1), current_date, 100);
do $$
begin
  insert into public.release_metrics (user_id, track_id, measured_on, spotify_streams)
  values ('11111111-1111-1111-1111-111111111111', (select id from public.tracks limit 1), current_date, 200);
  raise exception 'ÉCHEC : doublon accepté';
exception
  when unique_violation then
    raise notice 'OK : un seul relevé par track et par date';
end $$;

\echo '--- Un BPM aberrant est-il refusé ? (attendu : erreur)'
do $$
begin
  insert into public.tracks (user_id, title, bpm)
  values ('11111111-1111-1111-1111-111111111111', 'BPM invalide', 900);
  raise exception 'ÉCHEC : BPM hors limites accepté';
exception
  when check_violation then
    raise notice 'OK : BPM hors limites refusé';
end $$;

\echo '--- Suppression d''une track : les enfants suivent-ils en cascade ?'
delete from public.tracks where title = 'Track de A';
select
  (select count(*) from public.track_tasks) as taches_restantes,
  (select count(*) from public.label_submissions) as envois_restants,
  (select count(*) from public.release_metrics) as releves_restants,
  (select count(*) from public.labels) as labels_restants;

reset role;
