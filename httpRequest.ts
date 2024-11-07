export const httpRequest = async <T = any>(
    method: "POST" | "GET" = "GET",
    url: string,
    data?: Record<string, any>
  ): Promise<T> => {
    const body = data && JSON.stringify(data);
  
    const response = await fetch(url, {
      method,
      body,
    });
    const responseText = await response.text();
    const responseObject = JSON.parse(responseText);
  
    return responseObject;
  };
  
export const httpGET = <T>(url: string) => httpRequest<T>('GET', url);
export const httpPOST = <T>(url: string, data?: Record<string, any>) => httpRequest<T>('POST', url, data);
