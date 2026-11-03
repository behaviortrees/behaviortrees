// behavior3 titles can name properties in angle brackets ("Wait
// <milliseconds>ms"); the canvas shows them filled in ("Wait 2000ms"), as the
// classic editor does. Unknown or empty properties keep the placeholder. The
// stored title keeps its placeholders, so exports are unchanged.
export function displayTitle(title: string, properties: Record<string, unknown> | undefined): string {
  if (!properties) return title;
  return title.replace(/<(\w+)>/g, (placeholder, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) return placeholder;
    const value = properties[key];
    if (value === undefined || value === null || value === '') return placeholder;
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}
