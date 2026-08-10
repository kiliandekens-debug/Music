/** Génère un fichier WAV de test (440 Hz) pour la vérification.
 *  Usage : node make-wav.mjs <chemin> [durée en secondes] */
import { writeFileSync } from "node:fs";

const sampleRate = 8000;
const seconds = Number(process.argv[3] ?? 180);
const samples = sampleRate * seconds;
const data = Buffer.alloc(samples * 2);
for (let i = 0; i < samples; i += 1) {
  const value = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000);
  data.writeInt16LE(value, i * 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

writeFileSync(process.argv[2] ?? "/tmp/demo.wav", Buffer.concat([header, data]));
console.log("WAV généré :", process.argv[2] ?? "/tmp/demo.wav");
