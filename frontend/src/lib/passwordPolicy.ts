export function getPasswordHint(t: (key: string) => string): string {
  return t("auth.passwordHint");
}

export function validateCognitoPassword(
  password: string,
  t: (key: string) => string
): string | null {
  if (password.length < 8) {
    return t("auth.passwordMinLength");
  }
  if (!/[a-z]/.test(password)) {
    return t("auth.passwordLowercase");
  }
  if (!/[A-Z]/.test(password)) {
    return t("auth.passwordUppercase");
  }
  if (!/[0-9]/.test(password)) {
    return t("auth.passwordNumber");
  }
  return null;
}
