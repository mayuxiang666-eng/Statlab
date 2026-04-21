import axios from "axios";

const API_BASE = "/api";

export const login = async (username: string, password: string) => {
  const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
  return res.data;
};

export const register = async (username: string, password: string, name: string) => {
  const res = await axios.post(`${API_BASE}/auth/register`, { username, password, name });
  return res.data;
};

export const getMe = async (token: string) => {
  const res = await axios.get(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};
