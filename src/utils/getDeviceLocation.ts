export function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Доступ к геолокации отклонён. Разрешите в браузере (иконка замка → Геолокация) или введите адрес вручную.';
    case error.POSITION_UNAVAILABLE:
      return 'Местоположение недоступно. Включите «Службы геолокации» в Windows и попробуйте снова.';
    case error.TIMEOUT:
      return 'Определение заняло слишком много времени. Попробуйте ещё раз или введите адрес вручную.';
    default:
      return 'Не удалось получить координаты. Введите адрес вручную.';
  }
}

function requestPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function getDeviceLocation(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    throw new Error('Геолокация не поддерживается на этом устройстве');
  }

  if (!window.isSecureContext) {
    throw new Error('Геолокация работает только по HTTPS или на localhost. Откройте сайт по защищённому адресу.');
  }

  try {
    return await requestPosition({
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 300000,
    });
  } catch (firstError) {
    const geoError = firstError as GeolocationPositionError;
    if (geoError?.code === geoError.PERMISSION_DENIED) {
      throw new Error(getGeolocationErrorMessage(geoError));
    }

    try {
      return await requestPosition({
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 120000,
      });
    } catch (secondError) {
      const fallbackError = secondError as GeolocationPositionError;
      throw new Error(getGeolocationErrorMessage(fallbackError));
    }
  }
}
