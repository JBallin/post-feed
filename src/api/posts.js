const BASE_URL = 'https://dummyapi.io/data/v1';
const APP_ID = '61911ee21a52834977b1f525';
const DEFAULT_LIMIT = 20;

function normalizePost(post, likedIds, likeCountOverrides) {
  const likedByMe = likedIds.has(post.id);
  const serverLikes = Number(post.likes || 0);
  // If a like update failed earlier, keep that local value after refresh.
  const likes = Number.isFinite(likeCountOverrides.get(post.id))
    ? likeCountOverrides.get(post.id)
    : serverLikes;

  return {
    id: post.id,
    image: post.image,
    text: post.text || '',
    likes,
    publishDate: post.publishDate,
    likedByMe,
  };
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'app-id': APP_ID,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `API request failed (${response.status})`;

    try {
      const errorBody = await response.json();
      const apiMessage = errorBody?.error || errorBody?.data;
      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        message = `${message}: ${apiMessage}`;
      }
    } catch {
      // Ignore parse failures and keep generic status message.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function fetchPostsPage(
  page,
  limit = DEFAULT_LIMIT,
  likedIds = new Set(),
  likeCountOverrides = new Map(),
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const payload = await apiFetch(`/post?${params.toString()}`);
  const rawPosts = Array.isArray(payload.data) ? payload.data : [];
  const posts = rawPosts.map((post) => normalizePost(post, likedIds, likeCountOverrides));
  const total = Number(payload.total || 0);
  const hasMore = rawPosts.length === limit && (total === 0 || (page + 1) * limit < total);

  return {
    posts,
    hasMore,
  };
}

export async function updatePostLikes(postId, likes) {
  return apiFetch(`/post/${postId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ likes }),
  });
}

export { DEFAULT_LIMIT };
