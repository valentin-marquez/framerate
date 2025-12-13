import pcExpressRoute from "./v1/pc-express.route";
import spDigitalRoute from "./v1/sp-digital.route";
import myshopRoute from "./v1/myshop.route";

const API_VERSION = "v1";

export const routes = [
	{
		path: `/${API_VERSION}/pc-express`,
		route: pcExpressRoute,
	},
	{
		path: `/${API_VERSION}/sp-digital`,
		route: spDigitalRoute,
	},
	{
		path: `/${API_VERSION}/myshop`,
		route: myshopRoute,
	}
];
