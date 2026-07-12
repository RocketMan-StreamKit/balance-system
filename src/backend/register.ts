/** Parsed error body from balance backend REST endpoints. */
type RegisterErrorBody = {
  success?: boolean;
  code?: string;
  message?: string;
};

/**
 * Maps backend error codes to localized addon messages.
 * @param code Server error code.
 */
const mapRegisterErrorCode = (code?: string) => {
  switch (code) {
    case 'license_invalid':
      return {
        en: 'License is invalid or inactive. Activate your StreamKit+ license in Settings → License.',
        ru: 'Лицензия недействительна или неактивна. Активируйте лицензию StreamKit+ в Настройки → Лицензия.',
        uk: 'Ліцензія недійсна або неактивна. Активуйте ліцензію StreamKit+ у Налаштування → Ліцензія.',
      };
    case 'invalid_request':
      return {
        en: 'Invalid registration request. Authorize Twitch addon and ensure the broadcaster profile is available.',
        ru: 'Некорректный запрос регистрации. Авторизуйте аддон Twitch и убедитесь, что профиль стримера доступен.',
        uk: 'Некоректний запит реєстрації. Авторизуйте аддон Twitch і переконайтеся, що профіль стрімера доступний.',
      };
    case 'route_not_found':
      return {
        en: 'Balance API is not deployed on this server host. Use local.rocketman-streams.com in developer mode or deploy the backend.',
        ru: 'Balance API не развёрнут на этом сервере. В режиме разработчика используйте local.rocketman-streams.com или разверните бекенд.',
        uk: 'Balance API не розгорнуто на цьому сервері. У режимі розробника використовуйте local.rocketman-streams.com або розгорніть бекенд.',
      };
    default:
      return {
        en: 'Backend registration failed',
        ru: 'Ошибка регистрации на сервере',
        uk: 'Помилка реєстрації на сервері',
      };
  }
};

/**
 * Parses register response and throws a descriptive error on failure.
 * @param url Request URL (logged on failure).
 * @param rawResponse Raw HTTP response body.
 */
export const parseRegisterResponse = (url: string, rawResponse: string) => {
  const trimmed = rawResponse.trim();

  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    console.error(
      '[balance] register HTML response from',
      url,
      trimmed.slice(0, 200)
    );
    const mapped = mapRegisterErrorCode('route_not_found');
    throw new Error(mapped[LANG.current] ?? mapped.en);
  }

  let parsed: RegisterErrorBody & {
    licenseId?: string;
    sessionToken?: string;
    viewerPageUrl?: string;
  };

  try {
    parsed = JSON.parse(trimmed) as typeof parsed;
  } catch (error) {
    console.error(
      '[balance] register non-JSON response from',
      url,
      trimmed.slice(0, 500)
    );
    throw new Error(
      `Backend returned non-JSON response (${trimmed.slice(0, 80)})`
    );
  }

  if (!parsed.success || !parsed.sessionToken) {
    console.error('[balance] register failed:', { url, body: parsed });
    const mapped = mapRegisterErrorCode(parsed.code);
    throw new Error(parsed.message ?? mapped[LANG.current] ?? mapped.en);
  }

  return parsed;
};

/**
 * Resolves license auth payload for backend register from the addon sandbox API.
 * Sends MD5 device key fingerprint as `accessToken` and license order ID as `licenseId`.
 * @example const auth = resolveLicenseAuth();
 */
export const resolveLicenseAuth = () => {
  if (!license.active) {
    throw new Error(
      'StreamKit+ license is inactive. Activate your license in Settings → License.'
    );
  }

  const licenseId = license.id.trim();
  const accessToken = license.keyMd5.trim();

  if (!licenseId || !accessToken) {
    throw new Error(
      'License data is unavailable. Activate your license in Settings → License and restart the addon.'
    );
  }

  return {
    accessToken,
    licenseId,
  };
};
