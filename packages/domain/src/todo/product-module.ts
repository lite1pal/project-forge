import type {
  ProductModuleOnboardingCopy,
  ProductModuleOnboardingStepView,
  ProductModuleShellConfig,
  ProductModuleWorkspaceScope,
  RegisteredProductModule
} from "../product/runtime-module.js";

import { todoProduct } from "./product.js";

const todoOnboardingCopy: ProductModuleOnboardingCopy = {
  completeSummaryDescription:
    todoProduct.onboardingContent.completeSummaryDescription,
  dismissFromSidebarLabel:
    todoProduct.onboardingContent.dismissFromSidebarLabel,
  emptyStateDescription: todoProduct.emptyStateCopy.emptyStateDescription,
  emptyStatePrimaryCtaHref: todoProduct.emptyStateCopy.primaryCtaHref ?? "/todo",
  emptyStatePrimaryCtaLabel:
    todoProduct.emptyStateCopy.primaryCtaLabel ?? "Open Todo",
  eyebrow: todoProduct.onboardingContent.eyebrow,
  incompleteSummaryDescription:
    todoProduct.onboardingContent.incompleteSummaryDescription,
  showInSidebarLabel: todoProduct.onboardingContent.showInSidebarLabel,
  title: todoProduct.onboardingContent.title
};

function buildWorkspaceSuffix(input: ProductModuleWorkspaceScope) {
  if (!input.activeOrganizationId) {
    return "";
  }

  const query = new URLSearchParams({
    organizationId: input.activeOrganizationId
  });

  if (input.activeProjectId) {
    query.set("projectId", input.activeProjectId);
  }

  return `?${query.toString()}`;
}

function toScopedHref(baseHref: string, workspaceSuffix: string) {
  return workspaceSuffix ? `${baseHref}${workspaceSuffix}` : baseHref;
}

export const todoProductModule = {
  manifest: todoProduct,
  buildOnboardingStepViews(
    _input: Parameters<RegisteredProductModule["buildOnboardingStepViews"]>[0]
  ): ProductModuleOnboardingStepView[] {
    return [];
  },
  getChrome() {
    return todoProduct.chrome;
  },
  getOnboardingScreenCopy() {
    return todoOnboardingCopy;
  },
  getRuntimeRegistrations(surface: "api" | "web" | "worker") {
    const registrations = todoProduct.runtime.registrations as RegisteredProductModule["manifest"]["runtime"]["registrations"];
    return registrations.filter(
      (registration) => registration.surface === surface
    );
  },
  getShellProductConfig(input: ProductModuleWorkspaceScope): ProductModuleShellConfig {
    const workspaceSuffix = buildWorkspaceSuffix(input);

    return {
      navItems: todoProduct.navItems.map((item) => ({
        href: toScopedHref(item.href, workspaceSuffix),
        id: item.id,
        label: item.label
      })),
      productName: todoProduct.name
    };
  },
  getWorkspaceSettingsCopy() {
    return todoProduct.workspaceSettings;
  }
} satisfies RegisteredProductModule;
