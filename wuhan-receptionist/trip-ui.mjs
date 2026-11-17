import {
  INTERESTS, PARTIES, HEADCOUNTS, NEEDS, PACES, TRANSPORTS,
  clearProfile, loadProfile, recommendPlaces, sanitizeNote, sanitizeProfile,
  saveProfile, selectionMarker
} from './profile.mjs';

const SCOPE = '只保存在这台浏览器，用来记住这次怎么逛。可以随时修改或清空。不会上传成账号，也不收集姓名、联系方式和精确位置。';

function button(label, className, onClick) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}

function choices(list, selected, onToggle) {
  const row = document.createElement('div');
  row.className = 'trip-choices';
  list.forEach((item) => {
    const on = Array.isArray(selected) ? selected.includes(item.id) : selected === item.id;
    const node = button(item.label, 'trip-choice' + (on ? ' is-on' : ''), () => onToggle(item.id));
    node.setAttribute('aria-pressed', on ? 'true' : 'false');
    row.appendChild(node);
  });
  return row;
}

function cloneProfile(source) {
  return { ...source, interests: [...(source.interests || [])], needs: [...(source.needs || [])] };
}

export function mountTripSheet(root, { store, onChange, onPlan, onToggle } = {}) {
  const loaded = loadProfile(store);
  let profile = loaded.profile;
  let failed = loaded.persisted === false;
  let step = 0;
  let expanded = !profile;
  let draft = profile && !profile.skipped ? cloneProfile(profile) : blank();

  function blank() {
    return { interests: [], party: null, headcount: null, needs: [], pace: null, transport: null, note: '', skipped: false };
  }

  function publish(next, persist) {
    const clean = sanitizeProfile(next);
    if (persist) {
      const saved = next ? saveProfile(store, next) : clearProfile(store);
      profile = saved.profile;
      failed = saved.persisted === false;
    } else {
      profile = clean;
    }
    if (onChange) onChange(profile);
  }

  function setExpanded(next) {
    expanded = next;
    root.hidden = !expanded;
    if (onToggle) onToggle(expanded);
    if (!expanded) {
      root.replaceChildren();
      return;
    }
    render();
  }

  function render() {
    root.innerHTML = '';
    if (!expanded) return;
    const card = document.createElement('div');
    card.className = 'trip-card';
    card.appendChild(askView());
    root.appendChild(card);
  }

  function savedChoices() {
    return profile && !profile.skipped;
  }

  function askView() {
    const box = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'trip-title';
    title.textContent = step === 0 ? '这次想看什么？' : step === 1 ? '和谁一起？' : '时间和怎么走？';
    box.appendChild(title);
    const hint = document.createElement('p');
    hint.className = 'trip-scope';
    hint.textContent = step === 0
      ? '选一两项就够，也可以先跳过。这是这次出游的偏好，不是性格测试。'
      : '缺的信息只在需要时再问。可以返回或跳过。';
    box.appendChild(hint);

    if (step === 0) {
      box.appendChild(choices(INTERESTS, draft.interests, (id) => {
        draft.interests = draft.interests.includes(id)
          ? draft.interests.filter((item) => item !== id)
          : draft.interests.concat(id).slice(0, 4);
        render();
      }));
      const note = document.createElement('textarea');
      note.className = 'trip-note';
      note.maxLength = 80;
      note.rows = 2;
      note.placeholder = '可写一句备忘，最多80字。不必留姓名或联系方式。';
      note.value = draft.note || '';
      note.addEventListener('input', () => { draft.note = sanitizeNote(note.value); });
      note.addEventListener('focus', () => {
        const scroller = note.closest('.trip');
        if (!scroller) return;
        const noteBox = note.getBoundingClientRect();
        const view = scroller.getBoundingClientRect();
        if (noteBox.top < view.top || noteBox.bottom > view.bottom) {
          scroller.scrollTop += noteBox.top - view.top - 8;
        }
      });
      box.appendChild(note);
    }
    if (step === 1) {
      box.appendChild(choices(PARTIES, draft.party, (id) => {
        draft.party = draft.party === id ? null : id;
        if (draft.party !== 'family') draft.needs = [];
        if (draft.party !== 'friends' && draft.party !== 'study') draft.headcount = null;
        render();
      }));
      if (draft.party === 'family') {
        const extra = document.createElement('p');
        extra.className = 'trip-scope';
        extra.textContent = '家庭的话，有没有老人、孩子，或希望少走路？';
        box.appendChild(extra);
        box.appendChild(choices(NEEDS, draft.needs, (id) => {
          draft.needs = draft.needs.includes(id) ? draft.needs.filter((item) => item !== id) : draft.needs.concat(id);
          render();
        }));
      }
      if (draft.party === 'friends' || draft.party === 'study') {
        const extra = document.createElement('p');
        extra.className = 'trip-scope';
        extra.textContent = '大概几位？用来提醒核对载客，不会叫车。';
        box.appendChild(extra);
        box.appendChild(choices(HEADCOUNTS, draft.headcount, (id) => {
          draft.headcount = draft.headcount === id ? null : id;
          render();
        }));
      }
    }
    if (step === 2) {
      box.appendChild(choices(PACES, draft.pace, (id) => { draft.pace = draft.pace === id ? null : id; render(); }));
      box.appendChild(choices(TRANSPORTS, draft.transport, (id) => { draft.transport = draft.transport === id ? null : id; render(); }));
    }

    const scope = document.createElement('p');
    scope.className = 'trip-scope';
    scope.textContent = failed ? `浏览器没能保存，这次选择只留在当前页面。${SCOPE}` : SCOPE;
    box.appendChild(scope);
    const actions = document.createElement('div');
    actions.className = 'trip-actions';
    if (step > 0) actions.appendChild(button('返回', 'trip-text', () => { step -= 1; render(); }));
    actions.appendChild(button(step === 2 ? '完成' : '下一步', 'trip-go', () => {
      if (step < 2) { step += 1; render(); return; }
      const clean = sanitizeProfile({ ...draft, skipped: false });
      publish(clean || { skipped: true }, true);
      setExpanded(false);
    }));
    if (savedChoices()) {
      actions.appendChild(button('取消', 'trip-text', () => {
        draft = cloneProfile(profile);
        step = 0;
        setExpanded(false);
      }));
      actions.appendChild(button('清空', 'trip-text', () => {
        draft = blank();
        step = 0;
        publish(null, true);
        setExpanded(false);
      }));
      const picks = recommendPlaces(profile);
      if (picks.length && onPlan) {
        actions.appendChild(button('用这些安排行程', 'trip-text', () => {
          const names = picks.map((item) => item.name).join('、');
          onPlan(`按这次选择安排：${names}。${selectionMarker(picks.map((item) => item.id))}`);
          setExpanded(false);
        }));
      }
    } else {
      actions.appendChild(button('先跳过', 'trip-text', () => {
        publish({ skipped: true }, true);
        setExpanded(false);
      }));
    }
    box.appendChild(actions);
    return box;
  }

  setExpanded(expanded);
  return {
    getProfile: () => profile,
    isOpen: () => expanded,
    toggle() {
      if (expanded) {
        if (savedChoices()) draft = cloneProfile(profile);
        step = 0;
        setExpanded(false);
        return;
      }
      step = 0;
      draft = savedChoices() ? cloneProfile(profile) : blank();
      setExpanded(true);
    }
  };
}
