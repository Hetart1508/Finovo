export const getData = async <T>(request: Promise<{ data: T }>) => (await request).data;
