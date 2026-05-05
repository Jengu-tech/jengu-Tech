/**
 * Formate un montant en FCFA avec séparateur de milliers compatible
 * avec toutes les polices (jsPDF Helvetica notamment).
 *
 * On évite Intl.NumberFormat("fr-FR") qui utilise des espaces fines
 * insécables (U+202F) non supportées par les polices PDF standard,
 * ce qui produit des caractères parasites comme "&".
 */
export function formatFCFA(n: number | string | null | undefined): string {
  const value = Number(n ?? 0);
  if (!Number.isFinite(value)) return "0 FCFA";
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded).toString();
  // Insère un espace simple ASCII tous les 3 chiffres
  const withSeparators = abs.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${withSeparators} FCFA`;
}

/** Variante sans suffixe, utile pour les cellules de tableau compactes. */
export function formatNombre(n: number | string | null | undefined): string {
  const value = Number(n ?? 0);
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded).toString();
  return `${sign}${abs.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

/**
 * Masque un numéro de téléphone : ne garde que les 2 premiers et 2 derniers
 * chiffres ; les chiffres intermédiaires sont remplacés par des "X" tout en
 * conservant le formatage (espaces, tirets, points).
 *
 * Exemples :
 *   "77 123 45 67"  -> "77 1XX XX 67"  (en réalité "77 XXX XX 67" si 8 chiffres)
 *   "771234567"     -> "77XXXXX67"
 *   "+221 77 123 45 67" -> "+2XX XX XXX XX 67"  (2 premiers / 2 derniers chiffres seulement)
 */
export function maskTelephone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone; // pas assez de chiffres pour masquer

  const firstKeep = 2;
  const lastKeep = 2;
  const total = digits.length;

  let digitIndex = 0;
  let result = "";
  for (const ch of phone) {
    if (/\d/.test(ch)) {
      if (digitIndex < firstKeep || digitIndex >= total - lastKeep) {
        result += ch;
      } else {
        result += "X";
      }
      digitIndex += 1;
    } else {
      result += ch;
    }
  }
  return result;
}
