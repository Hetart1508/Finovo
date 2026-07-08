export const TOAST_AUTO_CLOSE_MS = 1750;

export const getApiMessage = (error: any, fallback = "Something went wrong") => {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  return (
    data?.error ||
    data?.message ||
    error?.message ||
    fallback
  );
};

export const getApiSuccessMessage = (data: any, fallback: string) => {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  return data?.message || fallback;
};
