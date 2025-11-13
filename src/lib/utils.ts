import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a phone number into a valid WhatsApp number format (e.g., 62xxxx).
 * This is a client-safe utility function.
 * - Removes all non-digit characters.
 * - If it starts with '0', replaces it with '62'.
 * - If it doesn't start with '62' but is a plausible local number, prepends '62'.
 * @param nomor The phone number string to format.
 * @returns The formatted WhatsApp number.
 */
export function formatWhatsappNumber(nomor: string | number): string {
  if (!nomor) return '';
  let nomorStr = String(nomor).replace(/\D/g, '');
  if (nomorStr.startsWith('0')) {
    return '62' + nomorStr.substring(1);
  }
  if (nomorStr.startsWith('8')) {
    return '62' + nomorStr;
  }
  // Handles cases where it might already start with 62
  return nomorStr;
}
