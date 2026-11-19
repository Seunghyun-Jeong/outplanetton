// 메인 피드 카드가 헤더 밑으로 절반쯤 들어가면 위로 날아가 화면 밖으로 나가고,
// 잠시 뒤 유성이 되어 위에서 다시 내려와 배경 별로 앉는다. 위로 되돌려 그 카드 자리가 다시 보이면
// 별이 유성이 되어 위로 빠져나가고 카드가 위에서 떨어져 제자리로 돌아온다.
//
// 스크롤에 묶지 않고 시간으로 재생한다(Web Animations API). "던진다"는 느낌은 스크롤 속도와 상관없이
// 늘 같은 빠르기와 곡선에서 나온다. 위로 날리는 길은 스크롤과 방향이 같아서 계속 굴려도 비틀리지 않는다.
// 움직이는 것은 transform과 opacity뿐이고 카드 자리(레이아웃)는 그대로다.
// 언제 날리고 돌려놓을지는 IntersectionObserver가 넘겨주는 위치로 정해서 스크롤 중에 레이아웃을 읽지 않는다.
//
// 움직이는 것은 안쪽 .post-card이고, 관찰하는 것은 제자리에 있는 바깥 .post-summary다.
// IntersectionObserver는 transform까지 반영한 위치를 넘겨주므로, 움직이는 카드를 관찰하면 날아가는 동안의 값은
// 카드 자리가 아니라 옮겨진 모습 기준이 된다. 둘을 나눠서 날아가는 도중에도 자리가 얼마나 보이는지 알고,
// 그 자리에서 거꾸로 되돌린다(reverse).
(function () {
  'use strict';

  // 카드가 된 별은 이만큼만 둔다. 넘치면 오래된 것부터 끈다.
  // 하늘 한 장이 되감기면(스크롤 약 화면 20장) 그 장에 있던 별도 같이 사라지므로 보통은 여기까지 차지 않는다.
  const MAX_STARS = 12;

  // 보일 수 있는 높이 중 이만큼 아래로만 남으면 날린다(캡션은 이미 지나간 뒤다).
  // 돌아올 때는 조금 더 보여야 돌아오게 해서, 경계에서 스크롤이 떨려도 날아갔다 돌아왔다 하지 않는다.
  const THROW_BELOW = 0.45;
  const RETURN_FROM = 0.6;

  // 살짝 가라앉았다가(준비 동작) 가속해 빠져나간다. 끝의 감속은 헤더 밑, 화면 밖이라 보이지 않는다
  const THROW_MS = 520;
  const THROW_EASE = 'cubic-bezier(0.5, -0.12, 0.35, 1)';
  // 카드 아랫변이 화면 위로 다 나가고도 이만큼 더 올라간다
  const LIFT_EXTRA = 120;

  // 카드가 나간 뒤 잠깐 쉬었다가 유성이 들어온다. 빠르게 들어와 천천히 자리 잡는다
  const METEOR_DELAY_MS = 140;
  const METEOR_MS = 900;
  const METEOR_EASE = 'cubic-bezier(0.15, 0.6, 0.25, 1)';

  // 되돌릴 때 별이 먼저 가속하며 떠나고, 조금 뒤 카드가 떨어져 아주 조금 지나쳤다가 제자리에 앉는다
  const ASCEND_MS = 380;
  const ASCEND_EASE = 'cubic-bezier(0.6, 0, 0.9, 0.45)';
  const FALL_DELAY_MS = 120;
  const FALL_MS = 560;
  const FALL_EASE = 'cubic-bezier(0.2, 0.85, 0.3, 1.04)';

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function cssPx(el, name) {
    return parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;
  }

  window.cardsToStars = function (container) {
    // 움직임을 줄여 둔 사용자에게는 켜지 않는다. 켜지 않으면 카드는 평소처럼 스크롤된다
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches || !Element.prototype.animate) return;

    // 헤더 아랫선. CSS 변수가 주인이고 여기서는 읽기만 한다
    const root = document.documentElement;
    const headerLine = cssPx(root, '--header-gap') + cssPx(root, '--header-height');

    // 카드(바깥 상자) → { body, state, side, landing, anim, meteor, star }
    // state는 가는 방향이다. here(제자리) → throwing(날아가는 중) → gone(날아감) → returning(돌아오는 중) → here.
    // 도중에 방향을 바꾸면 throwing과 returning이 서로 바뀐다
    const cards = new WeakMap();
    const lit = [];   // 켠 별, 켠 순서대로
    let layer = null;
    // 보는 도중에 움직임 줄이기를 켜면 true. 기다리던 유성도 더는 띄우지 않는다
    let off = false;

    function track(card) {
      if (cards.has(card)) return;
      // 움직이는 쪽은 안쪽 카드다. 없으면 card 조각이 바뀐 것이므로 넘어가지 않고 여기서 드러낸다
      const body = card.querySelector(':scope > .post-card');
      if (!body) throw new Error('.post-summary 안에 .post-card가 없습니다');
      cards.set(card, { body, state: 'here', side: 1, landing: null, anim: null, meteor: null, star: null });
      observer.observe(card);
    }

    function meteorLayer() {
      if (!layer || !layer.isConnected) {
        layer = document.createElement('div');
        layer.className = 'meteor-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
      }
      return layer;
    }

    // x에서 화면 가장자리 쪽(side)으로 want만큼, 모자라면 가장자리 3px 앞까지 옮긴 위치.
    // 유성은 카드 뒤에 그려서 카드와 겹치면 가려진다. 그래서 유성 길은 별이 앉는 바깥 여백 안에서만 잡는다
    function edgeward(x, side, want) {
      const room = side < 0 ? x - 3 : window.innerWidth - 3 - x;
      return x + side * Math.min(want, Math.max(0, room));
    }

    // from에서 to로 유성 하나를 날린다. tail은 꼬리 길이 비율 [처음, 끝]. 빠를 때 길고 느려지면 짧다
    function flyMeteor(from, to, { duration, easing, tail, fadeIn, onArrive }) {
      const meteor = document.createElement('div');
      meteor.className = 'meteor';
      meteor.innerHTML = '<i class="meteor-tail"></i><i class="meteor-head"></i>';
      meteorLayer().appendChild(meteor);

      const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
      const timing = { duration, easing, fill: 'forwards' };
      const move = meteor.animate([
        { transform: `translate(${from.x}px, ${from.y}px)`, opacity: fadeIn ? 0 : 1 },
        { opacity: 1, offset: 0.12 },
        { transform: `translate(${to.x}px, ${to.y}px)`, opacity: 1 }
      ], timing);
      meteor.firstChild.animate([
        { transform: `rotate(${angle}deg) scaleX(${tail[0]})` },
        { transform: `rotate(${angle}deg) scaleX(${tail[1]})` }
      ], timing);

      let stopped = false;
      move.onfinish = () => {
        meteor.remove();
        if (!stopped && onArrive) onArrive();
      };
      return {
        cancel() {
          stopped = true;
          meteor.remove();
        }
      };
    }

    // 기다렸다가 시작하는 일. 기다리는 중에도, 시작한 뒤에도 같은 cancel로 멈춘다
    function later(ms, start) {
      let inner = null;
      const timer = setTimeout(() => { if (!off) inner = start(); }, ms);
      return {
        cancel() {
          clearTimeout(timer);
          if (inner) inner.cancel();
        }
      };
    }

    function forgetStar(star) {
      const i = lit.indexOf(star);
      if (i >= 0) lit.splice(i, 1);
      star.remove();
    }

    function light(c, at) {
      c.meteor = null;
      if (c.state !== 'gone' || !window.starfieldAddStar) return;
      const star = window.starfieldAddStar(at.x, at.y);
      if (!star) return;
      c.star = star;

      // 하늘이 되감겨 이미 사라진 별은 빼고 센다
      for (let i = lit.length - 1; i >= 0; i--) {
        if (!lit[i].isConnected) lit.splice(i, 1);
      }
      lit.push(star);
      while (lit.length > MAX_STARS) lit.shift().remove();
    }

    // 카드 움직임 하나를 건다. 끝나면 그때의 state(가던 방향)대로 날아간 채 멈추거나 제자리에 앉는다.
    // fill: 'both'라서 끝난 뒤에도 마지막 모습이 남아 있다가 클래스를 바꾸고 지울 때 사라지고,
    // 기다리는 동안(delay)에는 첫 모습이 걸려 있어 제자리에 카드가 미리 비치지 않는다
    function move(card, c, keyframes, timing) {
      const anim = c.body.animate(keyframes, Object.assign({ fill: 'both' }, timing));
      c.anim = anim;
      anim.onfinish = () => {
        if (c.state === 'throwing') leave(card, c);
        else arrive(c);
      };
    }

    function stopMoving(c) {
      if (c.anim) c.anim.cancel();
      c.anim = null;
    }

    // 가던 길을 지금 모습에서 거꾸로 간다. 남은 길이 짧으면 그만큼 빨리 끝난다
    function turnBack(c, state) {
      c.state = state;
      c.anim.reverse();
    }

    // 화면 위로 나간 채 멈춘다. 헤더 밑, 별자리보다 화면 가장자리 쪽에서 유성이 나와 별자리로 비스듬히 내려앉는다.
    // 휴대폰은 여백이 20px라 거의 곧게 떨어진다
    function leave(card, c) {
      // 클래스를 먼저 붙이고 애니메이션을 지워야 제자리에 카드가 한 번 비치지 않는다
      card.classList.add('thrown');
      stopMoving(c);
      c.state = 'gone';

      const landing = c.landing;
      const from = { x: edgeward(landing.x, c.side, rand(120, 220)), y: headerLine - 12 };
      c.meteor = later(METEOR_DELAY_MS, () => flyMeteor(from, landing, {
        duration: METEOR_MS, easing: METEOR_EASE, tail: [1, 0.05], fadeIn: true,
        onArrive: () => light(c, landing)
      }));
    }

    function arrive(c) {
      stopMoving(c);
      c.state = 'here';
    }

    function throwUp(card, c, rect) {
      c.state = 'throwing';
      c.side = Math.random() < 0.5 ? -1 : 1;

      // 별이 앉을 자리. 데스크톱은 카드 옆 빈 하늘, 휴대폰은 카드 옆 여백(20px).
      // spread 0이면 카드 가장자리, 1이면 화면 끝
      const half = rect.width / 2;
      const spread = rand(0.25, 0.75);
      c.landing = {
        x: rect.left + half + c.side * (half * (1 - spread) + window.innerWidth / 2 * spread),
        y: headerLine + rand(90, Math.max(120, (window.innerHeight - headerLine) * 0.5))
      };

      const lift = rect.bottom + LIFT_EXTRA;
      move(card, c, [
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { opacity: 1, offset: 0.75 },
        { transform: `translateY(${-lift}px) scale(0.92)`, opacity: 0 }
      ], { duration: THROW_MS, easing: THROW_EASE });
    }

    function bringBack(card, c, rect) {
      c.state = 'returning';
      if (c.meteor) {
        c.meteor.cancel();
        c.meteor = null;
      }

      // 별이 남아 있으면 들어왔던 길을 거슬러 위로 빠져나가고, 그 뒤에 카드가 떨어진다
      let delay = 0;
      const star = c.star;
      c.star = null;
      if (star && star.isConnected) {
        const r = star.getBoundingClientRect();
        const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        forgetStar(star);
        const to = { x: edgeward(from.x, c.side, rand(120, 220)), y: headerLine - 30 };
        flyMeteor(from, to, { duration: ASCEND_MS, easing: ASCEND_EASE, tail: [0.15, 1], fadeIn: false });
        delay = FALL_DELAY_MS;
      }

      const lift = rect.bottom + LIFT_EXTRA;
      card.classList.remove('thrown');
      move(card, c, [
        { transform: `translateY(${-lift}px) scale(0.92)`, opacity: 0 },
        { opacity: 1, offset: 0.3 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ], { duration: FALL_MS, delay, easing: FALL_EASE });
    }

    // 화면 위가 아닌 곳에서 다시 만난 날아간 카드(맨 위로 건너뛰었다가 내려온 경우 등)와
    // 움직임 줄이기를 켠 때는 연출 없이 제자리에 둔다
    function restore(card, c) {
      stopMoving(c);
      if (c.meteor) c.meteor.cancel();
      if (c.star) forgetStar(c.star);
      c.meteor = null;
      c.star = null;
      card.classList.remove('thrown');
      c.state = 'here';
    }

    // 0.05 간격으로 알려 달라고 해서, 보이는 몫이 기준을 넘는 순간을 놓치지 않는다.
    // 관찰하는 바깥 상자는 움직이지 않으므로 날아가는 도중의 알림도 카드 자리 기준이다
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const card = entry.target;
        const c = cards.get(card);
        if (!c || !card.isConnected) {
          observer.unobserve(card);
          continue;
        }

        const rect = entry.boundingClientRect;
        const view = entry.rootBounds;

        // 카드 자리가 헤더 밑에 다 들어왔다. 돌아오는 중이면 그대로 둔다
        if (rect.top >= view.top) {
          if (c.state === 'throwing') turnBack(c, 'returning');
          else if (c.state === 'gone') restore(card, c);
          continue;
        }

        // 보일 수 있는 높이(카드가 화면보다 길면 화면 높이) 중 지금 보이는 몫.
        // 그냥 보이는 비율로 재면 화면보다 긴 카드(가로로 눕힌 휴대폰)는 절반을 넘지 못해 돌아오지 못한다
        const shown = entry.intersectionRect.height / Math.min(rect.height, view.height);

        if (c.state === 'here' && shown < THROW_BELOW) {
          throwUp(card, c, rect);
        } else if (c.state === 'throwing' && shown >= RETURN_FROM) {
          turnBack(c, 'returning');
        } else if (c.state === 'gone' && shown >= RETURN_FROM) {
          bringBack(card, c, rect);
        } else if (c.state === 'returning' && shown < THROW_BELOW) {
          turnBack(c, 'throwing');
        }
      }
    }, {
      rootMargin: `-${headerLine}px 0px 0px 0px`,
      threshold: Array.from({ length: 21 }, (_, i) => i / 20)
    });

    function isCard(node) {
      return node.nodeType === 1 && node.classList.contains('post-summary');
    }

    container.querySelectorAll('.post-summary').forEach(track);

    // 무한 스크롤로 붙는 묶음과 탭을 바꿔 갈아 끼운 묶음도 같은 상자에 들어온다
    const arrivals = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(node => { if (isCard(node)) track(node); });
        record.removedNodes.forEach(node => { if (isCard(node)) observer.unobserve(node); });
      }
    });
    arrivals.observe(container, { childList: true });

    // 보는 도중에 움직임 줄이기를 켜면 바로 멈춘다. 날아가는 중이던 카드까지 제자리에 두고,
    // 기다리던 유성과 날고 있던 유성, 카드가 된 별도 모두 끈다.
    // 날아가는 중이던 애니메이션을 지우지 않으면 끝날 때 카드를 다시 숨기고 유성을 띄운다
    reduce.addEventListener('change', () => {
      if (!reduce.matches) return;
      off = true;
      observer.disconnect();
      arrivals.disconnect();
      container.querySelectorAll('.post-summary').forEach(card => {
        const c = cards.get(card);
        if (c) restore(card, c);
      });
      lit.splice(0).forEach(star => star.remove());
      if (layer) layer.remove();
    });
  };
})();
