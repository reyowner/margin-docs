import { Mark, mergeAttributes } from '@tiptap/core';

export const CommentAnchor = Mark.create({
  name: 'commentAnchor',
  inclusive: false,
  addAttributes() {
    return {
      anchorId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-anchor'),
        renderHTML: (attrs) => ({ 'data-comment-anchor': attrs.anchorId }),
      },
    };
  },
  parseHTML() { return [{ tag: 'span[data-comment-anchor]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'comment-anchor' }), 0]; },
});

export const SuggestionAnchor = Mark.create({
  name: 'suggestionAnchor',
  inclusive: false,
  addAttributes() {
    return {
      anchorId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-suggestion-anchor'),
        renderHTML: (attrs) => ({ 'data-suggestion-anchor': attrs.anchorId }),
      },
    };
  },
  parseHTML() { return [{ tag: 'span[data-suggestion-anchor]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'suggestion-anchor' }), 0]; },
});
