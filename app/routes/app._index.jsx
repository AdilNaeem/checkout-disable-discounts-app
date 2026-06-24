import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Query shop state and functions separately so errors in one don't mask the other
  const [shopRes, fnRes] = await Promise.all([
    admin.graphql(
      `#graphql
      query {
        shop {
          id
          enabled: metafield(namespace: "$app:discount-settings", key: "enabled") {
            value
          }
          discountGid: metafield(namespace: "$app:discount-settings", key: "discount-id") {
            value
          }
        }
      }`,
    ),
    admin.graphql(
      `#graphql
      query {
        shopifyFunctions(first: 25) {
          nodes {
            id
            apiType
          }
        }
      }`,
    ),
  ]);

  const shopData = await shopRes.json();
  const fnData = await fnRes.json();

  const shop = shopData.data.shop;

  // Capture any GraphQL-level errors from the functions query
  const fnQueryErrors = fnData.errors?.map((e) => e.message).join(", ") ?? null;
  const allFunctions = fnData.data?.shopifyFunctions?.nodes ?? [];
  console.log("[discount-filter] shopifyFunctions:", JSON.stringify(allFunctions));
  const functionId =
    allFunctions.find((n) =>
      n.apiType?.toLowerCase().includes("cart_lines_discounts") ||
      n.apiType?.toLowerCase().includes("cart.lines.discounts")
    )?.id ??
    allFunctions[0]?.id ??
    null;

  let discountGid = shop.discountGid?.value ?? null;
  let setupError = null;

  if (!functionId) {
    setupError =
      fnQueryErrors ??
      "shopifyFunctions returned no results — run `shopify app deploy` then reload.";
  } else if (!discountGid) {
    // First load: create the always-on automatic discount that triggers the function
    const createRes = await admin.graphql(
      `#graphql
      mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
          automaticAppDiscount {
            discountId
          }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          automaticAppDiscount: {
            title: "Discount Code Filter",
            functionId,
            startsAt: new Date().toISOString(),
            discountClasses: ["ORDER", "PRODUCT", "SHIPPING"],
            combinesWith: {
              orderDiscounts: true,
              productDiscounts: true,
              shippingDiscounts: true,
            },
          },
        },
      },
    );

    const createData = await createRes.json();
    const userErrors =
      createData.data?.discountAutomaticAppCreate?.userErrors ?? [];
    const newGid =
      createData.data?.discountAutomaticAppCreate?.automaticAppDiscount
        ?.discountId ?? null;

    if (userErrors.length > 0) {
      setupError = userErrors.map((e) => e.message).join(", ");
    } else if (createData.errors?.length > 0) {
      setupError = createData.errors.map((e) => e.message).join(", ");
    }

    if (newGid) {
      discountGid = newGid;
      await admin.graphql(
        `#graphql
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }`,
        {
          variables: {
            metafields: [
              {
                ownerId: shop.id,
                namespace: "$app:discount-settings",
                key: "discount-id",
                value: newGid,
                type: "single_line_text_field",
              },
            ],
          },
        },
      );
    }
  }

  // Log to server console so it appears in `shopify app dev` terminal output
  if (setupError) {
    console.error("[discount-filter] setup error:", setupError);
  }

  return {
    enabled: shop.enabled?.value === "true",
    shopId: shop.id,
    ready: !!discountGid,
    setupError,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const currentEnabled = formData.get("enabled") === "true";
  const shopId = formData.get("shopId");

  await admin.graphql(
    `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "$app:discount-settings",
            key: "enabled",
            value: String(!currentEnabled),
            type: "boolean",
          },
        ],
      },
    },
  );

  return { enabled: !currentEnabled };
};

export default function Index() {
  const { enabled, shopId, ready, setupError } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isLoading = ["loading", "submitting"].includes(fetcher.state);
  const currentEnabled = fetcher.data?.enabled ?? enabled;

  const toggle = () => {
    fetcher.submit(
      { enabled: String(currentEnabled), shopId },
      { method: "POST" },
    );
  };

  useEffect(() => {
    if (fetcher.data !== undefined) {
      shopify.toast.show(
        fetcher.data.enabled
          ? "Discount filter enabled"
          : "Discount filter disabled",
      );
    }
  }, [fetcher.data?.enabled]);

  return (
    <s-page heading="Discount Filter Settings">
      <s-section heading="Discount Allowlist Function">
        <s-paragraph>
          Control whether the discount code allowlist function is active. When
          enabled, only codes in the allowlist will be accepted at checkout.
        </s-paragraph>
        {setupError && (
          <s-banner tone="critical">
            {setupError}
          </s-banner>
        )}
        <s-stack direction="inline" gap="base">
          <s-button
            onClick={toggle}
            variant={currentEnabled ? "primary" : "secondary"}
            disabled={!ready || undefined}
            {...(isLoading ? { loading: true } : {})}
          >
            {currentEnabled ? "Disable" : "Enable"}
          </s-button>
          <s-badge tone={currentEnabled && ready ? "success" : "critical"}>
            {currentEnabled && ready ? "Active" : "Inactive"}
          </s-badge>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
