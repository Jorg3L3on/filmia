import {
  MCP_SCOPES,
  MCP_SERVICE_DOCUMENTATION_PATH,
  getIssuer,
  getMcpResourceUrl,
  issuerUrl,
} from "@/lib/mcp-oauth/config";

/** RFC 9728 protected-resource metadata; same document for /api/mcp and /mcp. */
export const protectedResourceMetadata = () => ({
  resource: getMcpResourceUrl(),
  authorization_servers: [getIssuer()],
  scopes_supported: MCP_SCOPES,
  bearer_methods_supported: ["header"],
  resource_name: "Filmia",
  resource_documentation: issuerUrl(MCP_SERVICE_DOCUMENTATION_PATH),
});

/**
 * Exactly what the token endpoint accepts: `none` (PKCE) and `client_secret_post` (DCR
 * confidential clients, also with PKCE). private_key_jwt is not offered (decisión 5b952a3f).
 */
export const TOKEN_ENDPOINT_AUTH_METHODS = ["none", "client_secret_post"] as const;

/** RFC 8414 authorization-server metadata. */
export const authorizationServerMetadata = () => ({
  issuer: getIssuer(),
  authorization_endpoint: issuerUrl("/api/oauth/authorize"),
  token_endpoint: issuerUrl("/api/oauth/token"),
  registration_endpoint: issuerUrl("/api/oauth/register"),
  revocation_endpoint: issuerUrl("/api/oauth/revoke"),
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: [...TOKEN_ENDPOINT_AUTH_METHODS],
  revocation_endpoint_auth_methods_supported: [...TOKEN_ENDPOINT_AUTH_METHODS],
  scopes_supported: MCP_SCOPES,
  client_id_metadata_document_supported: true,
  authorization_response_iss_parameter_supported: true,
  service_documentation: issuerUrl(MCP_SERVICE_DOCUMENTATION_PATH),
});
