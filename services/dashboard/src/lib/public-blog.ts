export interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  created_at: string;
  updated_at?: string | null;
  reading_time?: number;
}

const API = "https://api.24go.site";

async function fetchBlogPage(url: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Public blog HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

/** Fail closed: ISR keeps its last complete sitemap on upstream failure. */
export async function getAllPublicBlogPosts(locale = "en"): Promise<PublicBlogPost[]> {
  const posts: PublicBlogPost[] = [];
  const seen = new Set<string>();
  let total = Infinity;
  while (posts.length < total) {
    const data = await fetchBlogPage(`${API}/api/v1/blog?locale=${locale}&limit=200&offset=${posts.length}`);
    if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0 ||
        (total !== Infinity && total !== data.total)) {
      throw new Error("Invalid or changing public blog pagination");
    }
    total = data.total;
    if ((!data.items.length && posts.length < total) || posts.length + data.items.length > total) {
      throw new Error("Incomplete public blog pagination");
    }
    for (const post of data.items) {
      if (typeof post.slug !== "string" || !post.slug || seen.has(post.slug) ||
          !Number.isFinite(Date.parse(post.created_at)) ||
          (post.updated_at != null && !Number.isFinite(Date.parse(post.updated_at)))) {
        throw new Error("Invalid or duplicate public blog article");
      }
      seen.add(post.slug);
      posts.push(post);
    }
  }
  return posts;
}
