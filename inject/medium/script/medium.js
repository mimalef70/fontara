window.browser = (function() {
  return window.msBrowser || window.browser || window.chrome;
})();
var patt = /[\u05D0-\u05EA]|[\u0620-\u063F]|[\u0641-\u064A]|[\u0675-\u06D3]|[\u0710-\u071C]|[\u071E-\u072F]|[\u074E-\u077F]|[\u08A0-\u08AC]|[\u08AE-\u08B4]|[\u07C1-\u07C9]|[\u07CC-\u07E9]/g;
var obsRun = false;
browser.storage.local.get('medium', function(items) {
  if (items.medium == true || items.medium == undefined) {
    let fix_font_visual = post_article => {
      let paragraphs = post_article.querySelectorAll('p');
      let i = 0,
        len = paragraphs.length;
      for (; i < len; i++) paragraphs[i].classList.add('p-rtl');
    };

    let run_against_article = post_article => {
      if (!patt.test(post_article.innerText)) return;

      post_article.classList.add('fonttools-rtl');
      fix_font_visual(post_article);
    };

    let run_on_page = () => {
      let post_articles = document.querySelectorAll(
        'article, .postArticle-content , .popover, .k'
      );
      if (!post_articles.length) return;

      let i = 0,
        len = post_articles.length;
      for (; i < len; i++) run_against_article(post_articles[i]);
    };
    obsRun = true;
    new MutationObserver(run_on_page).observe(document.body, {
      childList: true,
      subtree: true
    });
  }
});

browser.storage.onChanged.addListener(function(changes, namespace) {
  if (changes.medium != undefined) {
    browser.storage.local.get('medium', function(items) {
      if (items.medium == true || items.medium == undefined) {
        console.log('hello');
        let fix_font_visual = post_article => {
          let paragraphs = post_article.querySelectorAll('p');
          let i = 0,
            len = paragraphs.length;
          for (; i < len; i++) paragraphs[i].classList.add('p-rtl');
        };

        let run_against_article = post_article => {
          if (!patt.test(post_article.innerText)) return;
          post_article.classList.add('fonttools-rtl');
          fix_font_visual(post_article);
        };

        let run_on_page = () => {
          let post_articles = document.querySelectorAll(
            'article, .postArticle-content , .popover, .k'
          );
          if (!post_articles.length) return;

          let i = 0,
            len = post_articles.length;
          for (; i < len; i++) run_against_article(post_articles[i]);
        };
        if (obsRun == false) {
          run_on_page();
          new MutationObserver(run_on_page).observe(document.body, {
            childList: true,
            subtree: true
          });
        } else {
          run_on_page();
        }
      }
    });
  }
});
