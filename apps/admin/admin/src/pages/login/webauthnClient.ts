export interface PublicKeyCredentialDescriptorJSON {
  id: string;
  type: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
}

export interface RegistrationOptionsJSON {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: PublicKeyCredentialDescriptorJSON[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
}

export interface AuthenticationOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: PublicKeyCredentialDescriptorJSON[];
  userVerification?: UserVerificationRequirement;
}

export interface SerializedRegistrationCredential {
  id: string;
  rawId: string;
  type: string;
  authenticatorAttachment?: string;
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
}

export interface SerializedAuthenticationCredential {
  id: string;
  rawId: string;
  type: string;
  authenticatorAttachment?: string;
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
}

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(`${padded}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function mapDescriptors(
  descriptors?: PublicKeyCredentialDescriptorJSON[],
): PublicKeyCredentialDescriptor[] | undefined {
  if (!descriptors || descriptors.length === 0) return undefined;
  return descriptors.map(item => ({
    id: base64UrlToBuffer(item.id),
    type: item.type,
    transports: item.transports,
  }));
}

export async function createPasskeyCredential(
  options: RegistrationOptionsJSON,
): Promise<SerializedRegistrationCredential> {
  if (typeof navigator === 'undefined' || !navigator.credentials?.create) {
    throw new Error('WebAuthn passkeys are not supported in this browser.');
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: base64UrlToBuffer(options.challenge),
    rp: options.rp,
    user: {
      id: base64UrlToBuffer(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout,
    excludeCredentials: mapDescriptors(options.excludeCredentials),
    authenticatorSelection: options.authenticatorSelection,
    attestation: options.attestation,
  };

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error('Passkey registration was cancelled.');
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const transports =
    typeof response.getTransports === 'function' ? response.getTransports() : undefined;

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports,
    },
  };
}

export async function getPasskeyAssertion(
  options: AuthenticationOptionsJSON,
): Promise<SerializedAuthenticationCredential> {
  if (typeof navigator === 'undefined' || !navigator.credentials?.get) {
    throw new Error('WebAuthn passkeys are not supported in this browser.');
  }

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64UrlToBuffer(options.challenge),
    timeout: options.timeout,
    rpId: options.rpId,
    allowCredentials: mapDescriptors(options.allowCredentials),
    userVerification: options.userVerification,
  };

  const credential = (await navigator.credentials.get({
    publicKey,
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error('Passkey sign-in was cancelled.');
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined,
    },
  };
}
