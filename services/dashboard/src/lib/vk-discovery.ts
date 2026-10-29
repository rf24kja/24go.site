const errors: Record<string, [string, string]> = {
 vk_discovery_not_connected: ['Откройте Интеграции и подключите пользовательский токен VK с доступом groups.search.', 'Open Integrations and connect a VK user token with groups.search access.'],
 vk_reconnect_required: ['Откройте Интеграции и обновите пользовательский токен VK.', 'Open Integrations and renew the VK user token.'],
 vk_encryption_unavailable: ['Безопасное хранилище недоступно. Обратитесь к администратору.', 'Secure storage is unavailable. Contact the administrator.'],
 vk_unavailable: ['VK временно недоступен. Повторите позже.', 'VK is temporarily unavailable. Retry later.'],
 vk_invalid_response: ['VK вернул некорректный ответ. Повторите позже.', 'VK returned an invalid response. Retry later.'],
 vk_details_unavailable: ['Не удалось получить сведения сообществ VK. Повторите позже.', 'Cannot fetch VK community details. Retry later.'],
};
export function vkDiscoveryError(error: unknown, lang: string): string {
 const message = error instanceof Error ? error.message : '';
 const code = Object.keys(errors).find(key => message.includes(key));
 return code ? errors[code][lang === 'ru' ? 0 : 1] : lang === 'ru'
  ? 'Поиск VK недоступен. Откройте Интеграции для проверки пользовательского токена или повторите позже.'
  : 'VK search unavailable. Open Integrations to check the user token or retry later.';
}
