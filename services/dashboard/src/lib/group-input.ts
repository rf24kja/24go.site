// Convert only complete, explicitly supported representations to scanner identifiers.
// The API remains authoritative for admission, account eligibility and duplicates.
export function groupIdentifier(input: string, platform: string): string | null {
  if (input !== input.trim() || /[\x00-\x1f\x7f]/.test(input)) return null;
  if (platform === 'telegram') {
    const match = input.match(/^(?:@|https:\/\/t\.me\/)([A-Za-z][A-Za-z0-9_]{3,31})$/);
    return match ? `@${match[1]}` : null;
  }
  if (platform === 'vkontakte') {
    const match = input.match(/^(?:vk_|(?:https:\/\/(?:www\.)?vk\.com\/)?(?:club|public))([1-9][0-9]*)$/);
    return match ? `vk_${match[1]}` : null;
  }
  if (platform === 'facebook' && /^https:\/\/(?:www\.|m\.|mbasic\.)?facebook\.com\/groups\/[A-Za-z0-9][A-Za-z0-9._-]*\/?$/.test(input)) return input;
  return null;
}
export function groupLines(text: string, platform: string, lang: string) {
  const groups: { identifier: string; platform: string }[] = [];
  const errors: string[] = [];
  text.split('\n').forEach((line, index) => {
    if (line === '') return;
    const identifier = groupIdentifier(line, platform);
    if (identifier) groups.push({identifier, platform});
    else errors.push(lang === 'ru' ? `Строка ${index + 1} (${platform}): неверный идентификатор или ссылка` : `Line ${index + 1} (${platform}): invalid identifier or URL`);
  });
  return {groups, errors};
}
