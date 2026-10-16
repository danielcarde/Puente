export function renderResourceCards(grid, items, onSelect) {
  grid.replaceChildren();
  for (const resource of items) {
    const card = document.createElement('div');
    card.className = 'res-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const select = () => onSelect(String(resource.name ?? 'Unknown resource'));
    card.addEventListener('click', select);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
    });
    for (const [tag, cls, value] of [
      ['div', 'res-icon', resource.icon ?? ''],
      ['h4', '', resource.name ?? 'Unknown resource'],
      ['p', '', resource.desc || resource.address || '']
    ]) {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      node.textContent = String(value);
      if (tag === 'p') node.style.whiteSpace = 'pre-line';
      card.append(node);
    }
    const meta = document.createElement('div');
    meta.className = 'res-meta';
    const tags = Array.isArray(resource.tags) ? resource.tags : [];
    for (const value of tags) {
      if (typeof value !== 'string') continue;
      const tag = document.createElement('span');
      tag.className = 'tag'; tag.textContent = value; meta.append(tag);
    }
    if (resource.bilingual) {
      const tag = document.createElement('span');
      tag.className = 'bilingual-tag'; tag.textContent = 'Bilingual'; meta.append(tag);
    }
    card.append(meta); grid.append(card);
  }
}
export function appendChatMessage(container, role, text) {
  const message = document.createElement('div');
  const isBot = role === 'bot';
  message.className = isBot ? 'msg bot' : 'msg user';
  if (isBot) {
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar'; avatar.textContent = 'P'; message.append(avatar);
  }
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble'; bubble.textContent = String(text);
  bubble.style.whiteSpace = 'pre-wrap';
  message.append(bubble); container.append(message);
  container.scrollTop = container.scrollHeight;
}
