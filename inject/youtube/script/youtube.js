/**
    http://unicode-table.com/en/
    [\u05D0-\u05EA] - Hebrew
    [\u0620-\u063F]|[\u0641-\u064A]|[\u0675-\u06D3] - Arabic
    [\u0710-\u071C]|[\u071E-\u072F] - Syrian
    [\u074E-\u077F] - Arabic Supplement
    [\u08A0-\u08AC]|[\u08AE-\u08B4] - Arabic Extended
    [\u07C1-\u07C9]|[\u07CC-\u07E9] - Thâna
**/
const patt = /[\u05D0-\u05EA]|[\u0620-\u063F]|[\u0641-\u064A]|[\u0675-\u06D3]|[\u0710-\u071C]|[\u071E-\u072F]|[\u074E-\u077F]|[\u08A0-\u08AC]|[\u08AE-\u08B4]|[\u07C1-\u07C9]|[\u07CC-\u07E9]/g;

// let fix_font_visual = post_article => {
//   // Fonts in Hebrew usually look much better on sans-serif
//   let paragraphs = post_article.querySelectorAll('p');
//   let i = 0,
//     len = paragraphs.length;
//   for (; i < len; i++) paragraphs[i].classList.add('p-rtl');
// };

let run_against_article = post_article => {
  if (!patt.test(post_article.innerText)) return;

  post_article.classList.add('fonttools-rtl');
  // fix_font_visual(post_article);
};

let run_on_page = () => {
  let post_articles = document.querySelectorAll(
    'p,h1,h2,h3,h4,h5,h6,a,span,#description-text,#description,yt-formatted-string'
  );
  if (!post_articles.length) return;

  let i = 0,
    len = post_articles.length;
  for (; i < len; i++) run_against_article(post_articles[i]);
};
run_on_page();
new MutationObserver(run_on_page).observe(document.body, {
  childList: true,
  subtree: true
});
