import {Platform} from 'react-native';

export const API_BASE_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8000'
    : 'http://192.168.29.14:8000';

export const apiUrl = (path: string) =>
  `${API_BASE_URL}${path}`;
