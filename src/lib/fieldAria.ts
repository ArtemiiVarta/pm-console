/** aria-describedby / aria-invalid for the control inside a FormField (ids match FormField). */
export function fieldAria(id: string, error?: string, hasHelper = false) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hasHelper ? `${id}-helper` : undefined,
  }
}
