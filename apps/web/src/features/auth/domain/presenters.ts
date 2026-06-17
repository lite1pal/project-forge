import type { CurrentUserResponse } from "./schemas";

export function toCurrentUserViewModel(response: CurrentUserResponse) {
  return {
    email: response.user.email,
    hasMemberships: response.memberships.length > 0,
    name: response.user.name ?? response.user.email,
    userId: response.user.id
  };
}
