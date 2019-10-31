import http from "http";
import https from "https";
import {Compression} from "./compression";
import {ClientResponse, HttpRequestOptions} from "./types";
import {CONTENT_TYPE} from "./enums";
import Url from "fast-url-parser";
import {stringify} from "querystring";


class Http {
  httpAgent = new http.Agent({
    keepAlive: true
  });
  httpsAgent = new https.Agent({
    keepAlive: true
  });

  request(url: string, requestOptions: HttpRequestOptions, cb: (err: null | Error, clientResponse?: ClientResponse) => void): void {
    const requestProvider = url.startsWith('https') ? {
      agent: this.httpsAgent,
      client: https
    } : {
      agent: this.httpAgent,
      client: http
    };

    const requestBody = typeof requestOptions.body === "object" ?
      JSON.stringify(requestOptions.body) :
      typeof requestOptions.body === "string" ?
        requestOptions.body : undefined;

    const requestFormContent = !requestBody ?
      typeof requestOptions.form === "object" ?
        stringify(requestOptions.form as any) :
        typeof requestOptions.form === "string" ?
          requestOptions.form : undefined : undefined;


    const options = this.createRequestOptions(url, requestOptions, requestProvider.agent, requestBody, requestFormContent);

    const request = requestProvider.client.request(options, response => {
      Compression
        .handle(response, (err, body) => {
          if (err) return cb(err);

          cb(null, {
            body,
            response
          });
        });
    });

    request
      .on('error', e => cb(e))
      .on('timeout', request.abort);

    const writableContent = requestBody || requestFormContent;
    if (writableContent) {
      request.write(writableContent);
    }

    request.end();
  }

  private createRequestOptions(targetUrl: string, options: HttpRequestOptions, agent: http.Agent | https.Agent, bodyContent?: string, formContent?: string) {
    const url = Url.parse(targetUrl);

    const mergedOptions = {
      method: options.method || 'get',
      agent,
      hostname: url.hostname,
      port: url.port,
      protocol: url._protocol + ':',
      path: url.pathname + (url.search || ''),
      headers: {
        ...options.headers,
        'accept-encoding': Compression.getSupportedStreams()
      }
    } as https.RequestOptions | http.RequestOptions;

    if (options.httpTimeout) {
      mergedOptions.timeout = options.httpTimeout;
    }

    if (options.json) {
      mergedOptions.headers!['content-type'] = CONTENT_TYPE.ApplicationJson;
    }

    if (bodyContent) {
      mergedOptions.headers!['content-length'] = bodyContent.length;
      mergedOptions.headers!['content-type'] = CONTENT_TYPE.ApplicationJson;
    } else if (formContent) {
      mergedOptions.headers!['content-length'] = formContent.length;
      mergedOptions.headers!['content-type'] = CONTENT_TYPE.FormUrlEncoded;
    }

    return mergedOptions;
  }
}

export {
  Http
}
