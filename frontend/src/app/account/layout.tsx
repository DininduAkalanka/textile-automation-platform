import ShopLayout from '../(shop)/layout';

/**
 * The customer account pages (My Orders, order details, installments,
 * security) use the shop's header and footer. They sit outside the (shop)
 * route group, so they used to render with NO navigation at all: a customer
 * who opened "Track My Order" had no menu, cart or way back to the shop.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <ShopLayout>{children}</ShopLayout>;
}
