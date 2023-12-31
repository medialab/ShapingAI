import Vue from "vue";
import App from "./App.vue";
import router from "./router";

Vue.config.productionTip = false;

import { IconsPlugin } from "bootstrap-vue";
Vue.use(IconsPlugin);

Vue.prototype.$eventHub = new Vue(); // Global event bus

new Vue({
  router,
  render: (h) => h(App),
}).$mount("#app");
