import { cn } from "@/components/ui";

/**
 * En-tête commun aux trois pages.
 *
 * Le Studio, les Labels et la Promotion ressemblaient à trois applications
 * différentes : trois hauteurs de titre, trois façons de poser les filtres,
 * trois marges. Une seule structure ici, et les trois écrans se reconnaissent
 * comme des pièces d'un même meuble.
 *
 *   surtitre   — l'état de la page en une ligne de chiffres
 *   titre      — le nom de la page
 *   action     — le bouton principal, seul, à droite
 *   filtres    — la rangée qui trie ou restreint, sous le titre
 */
export function PageHeader({
  title,
  eyebrow,
  action,
  filters,
  className,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 lg:mb-7", className)}>
      <div className="flex items-end gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-2 text-muted">{eyebrow}</p> : null}
          <h1 className="text-page">{title}</h1>
        </div>
        {action ? <div className="ml-auto shrink-0 pb-1">{action}</div> : null}
      </div>
      {filters ? <div className="mt-4">{filters}</div> : null}
    </header>
  );
}
