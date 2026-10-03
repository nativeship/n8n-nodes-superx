import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class SuperxApi implements ICredentialType {
  name = "superxApi";
  displayName = "SuperX API";
  documentationUrl = "https://docs.superx.so/";
  icon: Icon = {
        light: "file:../nodes/Superx/superx.svg",
        dark: "file:../nodes/Superx/superx.dark.svg"
    };
  properties: INodeProperties[] = [
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
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                Authorization: "=Bearer {{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://api.superx.so",
            url: "/v1/posts/analytics"
        }
    };
}
