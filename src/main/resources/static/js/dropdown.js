// 드롭다운 열고 닫기의 주인. 헤더가 모든 화면에 싣는다.
//
// 드롭다운 7개(햄버거, 알림, 검색, 글 메뉴, 프로필 더보기, 프로필 정지 메뉴, 채팅 메뉴)가
// "바깥을 누르면 닫기"를 각자 갖고 있었고, 여는 버튼은 그 클릭이 자기 바깥 처리에 걸리지 않게
// stopPropagation으로 막았다. 그러면 다른 드롭다운의 바깥 처리도 그 클릭을 못 봐서 둘이 같이 열려 있었다.
// 그래서 열린 드롭다운 하나를 여기서만 기억하고, 새로 열면 앞의 것을 닫는다.
// 바깥 클릭과 Esc도 여기 한 곳에서 처리하니 화면은 등록만 한다.
(function () {
  'use strict';

  // 지금 열린 것 하나. { panel, button, inside, onClose }
  let current = null;

  function close() {
    if (!current) return;
    const closing = current;
    current = null;
    closing.panel.style.display = 'none';
    if (closing.button) closing.button.setAttribute('aria-expanded', 'false');
    if (closing.onClose) closing.onClose();
  }

  // 버튼 없이 코드가 여는 것(검색 결과, 채팅 메뉴)도 같은 길로 연다.
  // inside: 바깥 클릭으로 치지 않을 요소. 검색창처럼 패널 밖에서 계속 입력하는 경우에 쓴다.
  function open(panel, options) {
    const opts = options || {};
    if (current && current.panel === panel) return;
    close();
    current = { panel, button: opts.button || null, inside: opts.inside || null, onClose: opts.onClose || null };
    panel.style.display = 'block';
    if (current.button) current.button.setAttribute('aria-expanded', 'true');
  }

  function isOpen(panel) {
    return current !== null && current.panel === panel;
  }

  // 버튼으로 여닫는 드롭다운. onOpen은 열 때마다 부른다(알림 목록 불러오기 등).
  // 글 모달은 열릴 때마다 초기화를 다시 부르므로, 같은 버튼에 두 번 걸리지 않게 표시해 둔다.
  function bind(button, panel, options) {
    if (button.dataset.dropdownBound) return;
    button.dataset.dropdownBound = 'true';
    const opts = options || {};
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      if (isOpen(panel)) {
        close();
        return;
      }
      open(panel, { button, onClose: opts.onClose });
      if (opts.onOpen) opts.onOpen();
    });
  }

  // 캡처 단계에서 듣는다. 카드의 좋아요처럼 다른 코드가 stopPropagation을 해도 바깥 클릭을 놓치지 않는다.
  // 여는 버튼 자체를 누른 것은 바깥이 아니다. 그 버튼의 클릭 처리가 닫기를 맡는다.
  document.addEventListener('click', (e) => {
    if (!current) return;
    const t = e.target;
    if (current.panel.contains(t)) return;
    if (current.button && current.button.contains(t)) return;
    if (current.inside && current.inside.contains(t)) return;
    close();
  }, true);

  // Esc는 드롭다운부터 닫는다. 닫았으면 글 모달의 Esc 처리까지 가지 않게 여기서 멈춘다.
  // 이 파일이 글 모달 스크립트보다 먼저 실려서 같은 document 리스너 중 먼저 불린다.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !current) return;
    const button = current.button;
    close();
    e.stopImmediatePropagation();
    if (button) button.focus();
  });

  window.dropdown = { bind, open, close: (panel) => { if (isOpen(panel)) close(); }, isOpen };
})();
