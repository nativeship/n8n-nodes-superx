"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperxApi = void 0;
class SuperxApi {
    constructor() {
        this.name = "superxApi";
        this.displayName = "SuperX API";
        this.documentationUrl = "https://docs.superx.so/";
        this.icon = {
            light: "file:../nodes/Superx/superx.svg",
            dark: "file:../nodes/Superx/superx.dark.svg"
        };
        this.properties = [
            {
                displayName: "Access Token",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "=Bearer {{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://api.superx.so",
                url: "/v1/posts/analytics"
            }
        };
    }
}
exports.SuperxApi = SuperxApi;
//# sourceMappingURL=SuperxApi.credentials.js.map