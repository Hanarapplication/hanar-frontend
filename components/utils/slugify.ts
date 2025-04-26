// /utils/slugify.ts

export function slugify(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric characters with hyphens
      .replace(/(^-|-$)+/g, '');    // Remove starting/ending hyphens
  }
  