import axios from "axios";

const API_URL = "http://localhost:5000";

export const loginUser = async (email, password) => {
  try {
    const response = await axios.post(`${API_URL}/login`, { email, password });
    return response.data;
  } catch (error) {
    return { error: error.response.data.error };
  }
};
