import { memo, useMemo } from 'react';

function PostCard({ post, onToggleLike }) {
  const formattedDate = useMemo(() => {
    if (!post.publishDate) return '';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(post.publishDate),
    );
  }, [post.publishDate]);

  return (
    <article className="post-card">
      <img className="post-image" src={post.image} alt="Post image" loading="lazy" />
      <div className="post-content">
        <p className="post-text">{post.text || 'No caption provided.'}</p>
        <div className="post-meta">
          <button
            type="button"
            className={`like-button ${post.likedByMe ? 'liked' : ''}`}
            onClick={() => onToggleLike(post.id)}
            aria-pressed={post.likedByMe}
            aria-label={`${post.likedByMe ? 'Unlike' : 'Like'} post`}
          >
            {post.likedByMe ? 'Unlike' : 'Like'} ({post.likes})
          </button>
          <time className="post-date">{formattedDate}</time>
        </div>
      </div>
    </article>
  );
}

export default memo(PostCard);
