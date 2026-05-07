export function lockPageScroll() {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  const previousBodyOverflow = document.body.style.overflow;
  const previousHtmlOverflow = document.documentElement.style.overflow;
  const previousBodyPaddingRight = document.body.style.paddingRight;

  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  return () => {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  };
}
