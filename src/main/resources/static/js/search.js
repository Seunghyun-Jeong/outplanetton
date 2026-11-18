(function () {
  const input = document.getElementById('searchInput');
  const panel = document.getElementById('searchDropdown');
  if (!input || !panel) return;
  const box = input.closest('.search-box');

  let timer = null;
  let lastQuery = '';

  // 여닫기는 dropdown.js가 맡는다. 다른 드롭다운이 열리면 이것이 닫히고, 검색창을 누르는 것은 바깥이 아니다
  function show() {
    dropdown.open(panel, { inside: box });
  }

  function close() {
    dropdown.close(panel);
  }

  function renderEmpty(message) {
    panel.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.textContent = message;
    panel.appendChild(empty);
    show();
  }

  function buildUserRow(u) {
    const row = document.createElement('div');
    row.className = 'search-row';

    const avatar = document.createElement('img');
    avatar.className = 'search-avatar';
    avatar.src = u.profileImageUrl || '/images/default-profile.svg';
    avatar.alt = '프로필';

    const name = document.createElement('div');
    name.className = 'search-name';
    name.textContent = u.username;

    row.appendChild(avatar);
    row.appendChild(name);
    row.addEventListener('mousedown', () => {
      window.location.href = '/profile/' + u.id;
    });
    return row;
  }

  function buildTagRow(t) {
    const row = document.createElement('div');
    row.className = 'search-row';

    const icon = document.createElement('div');
    icon.className = 'search-tag-icon';
    icon.textContent = '#';

    const body = document.createElement('div');
    body.className = 'search-tag-body';

    const name = document.createElement('div');
    name.className = 'search-name';
    name.textContent = '#' + t.name;

    const count = document.createElement('div');
    count.className = 'search-sub';
    count.textContent = '게시물 ' + t.postCount + '개';

    body.appendChild(name);
    body.appendChild(count);

    row.appendChild(icon);
    row.appendChild(body);
    row.addEventListener('mousedown', () => {
      window.location.href = '/?tag=' + encodeURIComponent(t.name);
    });
    return row;
  }

  function render(data) {
    const users = data.users || [];
    const tags = data.hashtags || [];

    if (users.length === 0 && tags.length === 0) {
      renderEmpty('검색 결과가 없습니다.');
      return;
    }

    panel.innerHTML = '';

    if (users.length > 0) {
      const head = document.createElement('div');
      head.className = 'search-section';
      head.textContent = '계정';
      panel.appendChild(head);
      users.forEach(u => panel.appendChild(buildUserRow(u)));
    }

    if (tags.length > 0) {
      const head = document.createElement('div');
      head.className = 'search-section';
      head.textContent = '해시태그';
      panel.appendChild(head);
      tags.forEach(t => panel.appendChild(buildTagRow(t)));
    }

    show();
  }

  async function doSearch(q) {
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q), { credentials: 'include' });
      if (!res.ok) { close(); return; }
      const data = await res.json();
      if (input.value.trim() !== q) return;   // 그새 입력이 바뀌었으면 버린다
      render(data);
    } catch (e) {
      console.error(e);
      close();
    }
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(timer);

    if (q === '') { close(); lastQuery = ''; return; }
    if (q === lastQuery) return;
    lastQuery = q;

    // 타이핑이 멈춘 뒤에 한 번만 요청한다
    timer = setTimeout(() => doSearch(q), 250);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim() !== '' && panel.innerHTML !== '') {
      show();
    }
  });

  // 엔터를 치면 첫 번째 결과로 이동
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); input.blur(); return; }
    if (e.key !== 'Enter') return;
    const first = panel.querySelector('.search-row');
    if (first) first.dispatchEvent(new MouseEvent('mousedown'));
  });

})();
