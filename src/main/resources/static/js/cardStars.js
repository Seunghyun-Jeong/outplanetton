// 메인 피드 카드가 헤더 밑으로 절반쯤 들어가면 보이던 자리에서 작아져 별이 되고, 그 별이 유성이 되어
// 포물선을 그리며 위로 헤더 뒤까지 솟았다가 왼쪽이나 오른쪽으로 내려와 배경 별로 앉는다.
// 위로 되돌려 그 카드 자리가 다시 보이면 별이 같은 포물선을 거꾸로 날아와, 닿은 점에서 카드가 다시 커져 제자리로 돌아온다.
//
// 스크롤에 묶지 않고 시간으로 재생한다(Web Animations API). 작아지는 빠르기와 곡선은 스크롤 속도와 상관없이 늘 같다.
// 움직이는 것은 transform과 opacity뿐이고 카드 자리(레이아웃)는 그대로다.
// 언제 날리고 돌려놓을지는 IntersectionObserver가 넘겨주는 위치로 정해서 스크롤 중에 레이아웃을 읽지 않는다.
// 레이아웃은 카드가 별이 되는 순간 유성이 나갈 점을 정하려고 한 번만 읽는다.
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
  const THROW_BELOW = 0.5;
  const RETURN_FROM = 0.6;

  // 헤더 밑에 보이는 부분의 한가운데에서 카드 크기부터 별 크기(폭 STAR_PX)까지 한 번에 작아지고,
  // 그 점에서 유성이 나간다. 예전처럼 4분의 1에서 멈칫했다가 사라지면 어느 크기에서 갑자기 별로 바뀌는 것처럼 보였다(유저 확인).
  // 크기는 같은 시간마다 같은 비율로 준다(600px → 6px이면 100분의 1을 고르게 나눠 곱한다). 크기를 고르게 빼면
  // 처음에는 빠르고 작아질수록 거의 멈춘 것처럼 보이는데, 비율로 줄이면 처음부터 끝까지 같은 빠르기로 작아져 보인다.
  // 투명도는 끝까지 1이라 사라지지 않고 별 크기가 된 순간 유성 머리(3px)가 그 자리를 이어받는다.
  // 예전처럼 위로 날려 보내면 남은 아래쪽이 0.1~0.17초 만에 헤더 뒤로 숨어 작아지는 모습이 거의 보이지 않았다
  const STAR_PX = 6;
  const THROW_MS = 560;
  const THROW_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)';
  // 비율로 줄이는 곡선을 이만큼 잘라 키프레임으로 찍는다(약 0.04초 간격)
  const SHRINK_STEPS = 14;

  // 별이 된 점에서 바로 유성이 나가 포물선 하나로 날아가 앉는다. 위로 솟는 유성과 내려오는 유성을 따로 날리면
  // 둘이 따로 노는 것처럼 보여서(유저 확인) 한 번에 그린다. 꼭대기는 헤더 아랫선보다 이만큼 위, 헤더 뒤라서
  // 잠깐 헤더 너머로 넘어갔다 내려오는 것처럼 보인다. 앞부분은 빠르고 끝은 천천히 내려앉는다
  const ARC_OVER = 30;
  const ARC_MS = 1000;
  const ARC_EASE = 'cubic-bezier(0.25, 0.1, 0.35, 1)';
  // 포물선을 이만큼 잘라 키프레임으로 찍는다. 꼬리 방향도 점마다 맞춘다(약 0.04초 간격)
  const ARC_STEPS = 24;
  // 별이 화면 높이 전체를 내려가는 데 적어도 경로의 이만큼은 쓴다(landingY)
  const FALL_SHARE = 0.1;

  // 되돌릴 때는 별이 같은 포물선을 거꾸로 날아오고, 닿는 순간 그 점에서 카드가 커져 아주 조금 지나쳤다가 제자리에 앉는다
  const RETURN_MS = 700;
  const RETURN_EASE = 'cubic-bezier(0.4, 0, 0.6, 1)';
  const GROW_MS = 480;
  const GROW_EASE = 'cubic-bezier(0.2, 0.85, 0.3, 1.04)';

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

    // 카드(바깥 상자) → { body, state, side, anchor, anim, meteor, star }
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
      cards.set(card, { body, state: 'here', side: 1, anchor: 0, anim: null, meteor: null, star: null });
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

    // from에서 꼭대기 높이 apexY를 지나 to로 가는 포물선. 가로는 시간에 고르게 가고 세로는 2차식이라
    // 던진 물체처럼 꼭대기에서 느려진다. 꼭대기 시점 ta 앞뒤로 휘는 정도가 달라도 꼭대기에서 기울기가 0이라 꺾이지 않는다
    function arcPoints(from, to, apexY, ta) {
      const kUp = Math.max(1, from.y - apexY) / (ta * ta);
      const kDown = Math.max(1, to.y - apexY) / ((1 - ta) * (1 - ta));
      // 꼭대기 시점도 점으로 찍는다. 점 사이는 직선으로 이어져서, 꼭대기가 두 점 사이에 있으면
      // 카드 가장자리를 넘기 전부터 비스듬히 내려가 카드 폭 안을 지났다(휴대폰에서 꼭대기가 0.99일 때)
      const ts = [];
      for (let i = 0; i <= ARC_STEPS; i++) ts.push(i / ARC_STEPS);
      ts.push(ta);
      ts.sort((p, q) => p - q);
      return ts.map(t => {
        const k = t < ta ? kUp : kDown;
        return { t, x: from.x + (to.x - from.x) * t, y: apexY + k * (t - ta) * (t - ta) };
      });
    }

    // 카드 옆 하늘과 카드 자리 사이를 잇는 포물선. 꼭대기를 유성이 카드 가장자리를 넘는 순간에 둔다.
    // 유성은 카드 뒤 층이라 카드 폭 안에서 내려가면 다음 카드에 가려진다. 꼭대기가 가장자리에 있으면 카드 폭 안에서는
    // 비운 카드 자리와 헤더 뒤로 오르기만 하고, 내려가는 길은 전부 카드 밖 하늘이라 어느 높이에 앉아도 가려지지 않는다.
    // 예전에는 꼭대기 시점을 오르내리는 높이 비로 정해서, 낮게 앉을수록 꼭대기가 일찍 와 카드 폭 안에서 내려갔다.
    // 그래서 별자리를 위쪽에서만 골라야 했고 별이 화면 위쪽에만 몰렸다(유저 확인)
    function arcBesideCard(from, to, cardX, half) {
      return arcPoints(from, to, headerLine - ARC_OVER, edgeTime(from, to, cardX, half));
    }

    // 유성이 카드 가장자리를 넘는 시점(0~1). 가로는 시간에 고르게 간다
    function edgeTime(from, to, cardX, half) {
      const sky = from.x === cardX ? to : from;
      const edgeX = cardX + Math.sign(sky.x - cardX) * half;
      const dx = to.x - from.x;
      return dx === 0 ? 0.5 : Math.min(0.995, Math.max(0.1, (edgeX - from.x) / dx));
    }

    // 별이 앉을 높이. 헤더 밑부터 하단 탭 위까지 고르되, 카드 밖 하늘에 머무는 시간만큼만 내려간다.
    // 화면 높이 전체를 경로의 FALL_SHARE 안에 내려가는 빠르기가 상한이다. 휴대폰은 카드 옆 여백이 20px라 경로의 1~3%만
    // 카드 밖이어서, 상한 없이 낮게 앉히면 별이 수십 ms 만에 뚝 떨어지는 줄처럼 보였다. 그래서 휴대폰은 위쪽 근처에 앉는다
    function landingY(ta) {
      const top = headerLine + 40;
      const tabs = document.querySelector('.feed-tabs');
      const bottom = (tabs ? tabs.getBoundingClientRect().top : window.innerHeight) - 24;
      const reach = Math.min(1, (1 - ta) / FALL_SHARE);
      return rand(top, Math.max(top + 20, top + (bottom - top) * reach));
    }

    // 포물선 위로 유성 하나를 날린다. tail은 꼬리 길이 비율 [처음, 끝]. 빠를 때 길고 느려지면 짧다.
    // 꼬리는 점마다 나아가는 방향으로 돌린다. 각도는 ±180°를 넘을 때 끊기지 않게 이어 붙인다(왼쪽으로 날 때)
    function flyMeteor(points, { duration, easing, tail, fadeIn, onArrive }) {
      const meteor = document.createElement('div');
      meteor.className = 'meteor';
      meteor.innerHTML = '<i class="meteor-tail"></i><i class="meteor-head"></i>';
      meteorLayer().appendChild(meteor);

      const last = points.length - 1;
      let prev = null;
      const angles = points.map((p, i) => {
        const a = points[Math.max(0, i - 1)];
        const b = points[Math.min(last, i + 1)];
        let deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        if (prev !== null) deg += 360 * Math.round((prev - deg) / 360);
        prev = deg;
        return deg;
      });
      const timing = { duration, easing, fill: 'forwards' };
      const move = meteor.animate(points.map(p => ({
        offset: p.t,
        transform: `translate(${p.x}px, ${p.y}px)`,
        opacity: fadeIn ? Math.min(1, p.t / 0.12) : 1
      })), timing);
      meteor.firstChild.animate(points.map((p, i) => ({
        offset: p.t,
        transform: `rotate(${angles[i]}deg) scaleX(${tail[0] + (tail[1] - tail[0]) * p.t})`
      })), timing);

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
      // 돌아오던 중에 다시 날리면, 카드 자리로 날아오던 유성은 더 오지 않는다
      if (state === 'throwing' && c.meteor) {
        c.meteor.cancel();
        c.meteor = null;
      }
      c.anim.reverse();
    }

    // 카드가 점이 되어 사라진 순간. 그 점에서 유성이 포물선을 그리며 헤더 뒤까지 솟았다가 카드 옆으로 내려앉는다.
    // 별자리는 데스크톱은 카드 옆 빈 하늘, 휴대폰은 카드 옆 여백(20px)이다. spread 0이면 카드 가장자리, 1이면 화면 끝.
    // 유성은 카드 뒤 층에 그린다. 가려지지 않게 하는 방법은 arcBesideCard에 있다
    function leave(card, c) {
      // 클래스를 먼저 붙이고 애니메이션을 지워야 제자리에 카드가 한 번 비치지 않는다
      card.classList.add('thrown');
      stopMoving(c);
      c.state = 'gone';

      // 작아지는 동안 스크롤했을 수 있어 지금 자리를 한 번 읽는다(효과가 끝날 때 한 번뿐이다)
      const r = card.getBoundingClientRect();
      const from = { x: r.left + r.width / 2, y: r.top + c.anchor };
      const half = r.width / 2;
      const spread = rand(0.25, 0.75);
      const landing = { x: from.x + c.side * (half * (1 - spread) + window.innerWidth / 2 * spread), y: 0 };
      landing.y = landingY(edgeTime(from, landing, from.x, half));
      // 기다리지 않고 바로 띄운다. 타이머를 거치면 별 크기 카드가 사라진 뒤 유성이 나오기까지 두 프레임이 비었다
      if (off) return;
      c.meteor = flyMeteor(arcBesideCard(from, landing, from.x, half), {
        duration: ARC_MS, easing: ARC_EASE, tail: [0.8, 0.05], fadeIn: false,
        onArrive: () => light(c, landing)
      });
    }

    function arrive(c) {
      stopMoving(c);
      c.state = 'here';
    }

    function throwUp(card, c, rect) {
      c.state = 'throwing';
      c.side = Math.random() < 0.5 ? -1 : 1;
      c.anchor = anchorOf(rect);

      move(card, c, shrinkFrames(c, rect), { duration: THROW_MS, easing: THROW_EASE });
    }

    // 카드 크기(1)에서 별 크기(starScale)까지 같은 비율로 줄어드는 키프레임. 되돌릴 때는 이것을 거꾸로 쓴다
    function shrinkFrames(c, rect) {
      const starScale = Math.min(1, STAR_PX / rect.width);
      const frames = [];
      for (let i = 0; i <= SHRINK_STEPS; i++) {
        const t = i / SHRINK_STEPS;
        frames.push({ offset: t, transform: pose(c, rect, Math.pow(starScale, t)) });
      }
      return frames;
    }

    // 작아지는 기준점. 카드 자리 윗변에서 헤더 밑에 보이는 부분의 한가운데까지의 거리다.
    // 카드 가운데는 헤더 뒤에 있어서 가운데 기준이면 보이던 부분이 줄면서 헤더 뒤로 끌려 들어간다
    function anchorOf(rect) {
      return (Math.max(rect.top, headerLine) + rect.bottom) / 2 - rect.top;
    }

    // 기준점을 고정한 채 scale배 한 모습. transform-origin을 바꾸지 않고 같은 효과의 translate를 더해서,
    // 움직이는 속성은 transform과 opacity뿐이다. 가운데 기준으로 scale(s)하면 기준점은 가운데 쪽으로
    // (1-s)×(기준점-가운데)만큼 끌려오므로 그만큼 되민다. translate와 scale이 같은 비율로 바뀌어서
    // 키프레임 사이에서도 기준점은 움직이지 않는다
    function pose(c, rect, scale) {
      const y = (1 - scale) * (c.anchor - rect.height / 2);
      return `translate(0px, ${y}px) scale(${scale})`;
    }

    function bringBack(card, c, rect) {
      c.state = 'returning';
      if (c.meteor) {
        c.meteor.cancel();
        c.meteor = null;
      }
      c.anchor = anchorOf(rect);

      // 별이 남아 있으면 같은 포물선을 거꾸로 날아와 카드 자리에 닿고, 그때부터 카드가 커진다.
      // 별이 하늘과 함께 되감겨 없으면 카드만 커진다
      const point = { x: rect.left + rect.width / 2, y: rect.top + c.anchor };
      let delay = 0;
      const star = c.star;
      c.star = null;
      if (star && star.isConnected) {
        const r = star.getBoundingClientRect();
        const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        forgetStar(star);
        c.meteor = later(0, () => flyMeteor(arcBesideCard(from, point, point.x, rect.width / 2), {
          duration: RETURN_MS, easing: RETURN_EASE, tail: [0.15, 0.6], fadeIn: false
        }));
        delay = RETURN_MS;
      }

      card.classList.remove('thrown');
      // 별 크기에서 카드 크기까지 같은 길을 거꾸로 커진다. 유성이 닿기 전(delay)에는 별 크기 카드가 미리 보이지 않게
      // 첫 모습만 투명하게 두고, 커지기 시작하면 바로 보인다
      const grow = shrinkFrames(c, rect).reverse().map(f => ({ offset: 1 - f.offset, transform: f.transform, opacity: 1 }));
      grow[0].opacity = 0;
      move(card, c, grow, { duration: GROW_MS, delay, easing: GROW_EASE });
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
