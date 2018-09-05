// PRELOADER
$(window).on('load', function() {
  'use strict';
  $('#loading').addClass('hidden');
});

(function($) {
  'use strict';

  /*====================================================*/
  /* VARIABLES                                           */
  /*====================================================*/
  var navBar = $('.custom-menu'),
    navbarLinks = $('.custom-menu .nav-link');

  /*====================================================*/
  /* STICKY NAVBAR                                      */
  /*====================================================*/
  $(window).on('scroll', function() {
    if ($(this).scrollTop() > 50) {
      $(navBar).addClass('navbar-is-sticky');
    } else {
      $(navBar).removeClass('navbar-is-sticky');
    }
  });

  $('.navbar-toggler').on('click', function(e) {
    $(this).toggleClass('menu-is-expanded');
  });

  $(document).on('click', '.navbar-collapse.show', function(e) {
    if ($(e.target).is('a')) {
      $(this).collapse('hide');
      $('.navbar-toggler').toggleClass('menu-is-expanded');
      // $('.Menu-Icon--Circle').css('transform', 'translateX(-50%) translateY(-50%) scale(1)');
    }
  });

  /*====================================================*/
  /* NAVBAR ON SCROLL EASING                            */
  /*====================================================*/
  $(navbarLinks).on('click', function(event) {
    var $anchor = $(this);
    $('html, body').stop().animate({
      scrollTop: ($($anchor.attr('href')).offset().top - 50)
    }, 1250, 'easeInOutExpo');
    event.preventDefault();
  });

  /*====================================================*/
  /* TESTIMONIAL SLIDER                                 */
  /*====================================================*/


  var $ClientsSlider = $('.testimonial-slider');
  if ($ClientsSlider.length > 0) {
    $ClientsSlider.owlCarousel({
      loop: true,
      center: true,
      margin: 0,
      items: 1,
      nav: false,
      dots: true,
      lazyLoad: true,
      dotsContainer: '.dots'
    })
    $('.owl-dot').on('click', function() {
      $(this).addClass('active').siblings().removeClass('active');
      $ClientsSlider.trigger('to.owl.carousel', [$(this).index(), 300]);
    });
  }

  var swiper = new Swiper('.screen-slider', {
    direction: 'horizontal',
    slidesPerView: 1,
    spaceBetween: 1,
    parallax: true,
    breakpoints: {
      480: {
        slidesPerView: 1,
        spaceBetween: 40
      }
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    }
  });

  /*====================================================*/
  /* TABS INIT                                   */
  /*====================================================*/
  $('.js-tabs a').on('click', function(e) {
    e.preventDefault();
    $(this).tab('show');
  });

  /*====================================================*/
  /* TOOLTIPS                                           */
  /*====================================================*/
  $('[data-toggle="tooltip"]').tooltip();

  /*====================================================*/
  /* VIDEO MODALS                                           */
  /*====================================================*/

  $('.js-video-modal-trigger').magnificPopup({
    type: 'iframe',
    iframe: {
      patterns: {
        youtube: {
          index: 'youtube.com/',
          id: function(url) {
            var m = url.match(/[\\?\\&]v=([^\\?\\&]+)/);
            if (!m || !m[1]) return null;
            return m[1];
          },
          src: '//www.youtube.com/embed/%id%?autoplay=1'
        },
        vimeo: {
          index: 'vimeo.com/',
          id: function(url) {
            var m = url.match(/(https?:\/\/)?(www.)?(player.)?vimeo.com\/([a-z]*\/)*([0-9]{6,11})[?]?.*/);
            if (!m || !m[5]) return null;
            return m[5];
          },
          src: '//player.vimeo.com/video/%id%?autoplay=1'
        }
      }
    }
  });

})(jQuery);
