<template>
  <div class="_textBox" @scroll="onScroll">
    <nav class="_menu">
      <div v-for="item in nav_menu" :key="item.path">
        <router-link :to="item.path">{{ item.name }}</router-link>
      </div>
    </nav>
    <div class="_textBox--content">
      <component :is="'style'">
        {{ active_btn_styles }}
      </component>
      <div v-if="!md_text" class="_cantLoad">N’a pas pu charger</div>
      <div ref="content" v-else v-html="md_text" @click="interceptBtn" />
    </div>
  </div>
</template>
<script>
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

export default {
  props: {
    nav_menu: Array,
    text: String,
    currently_active_image: [Boolean, Object],
    corpora_data: Array,
  },
  components: {},
  data() {
    return {
      scroll_view_margin_top: 200,
      // scroll_view_margin_top: window.innerHeight / 4,
    };
  },
  created() {
    this.$eventHub.$on("textBox.scroll_to_btn", this.scrollToBtn);
  },
  mounted() {},
  beforeDestroy() {
    this.$eventHub.$off("textBox.scroll_to_btn", this.scrollToBtn);
  },
  watch: {
    currently_active_image() {
      // if (this.currently_active_image)
      //   this.scrollToBtn(this.currently_active_image.id);
    },
  },
  computed: {
    md_text() {
      if (!this.text) return false;

      const renderer = new marked.Renderer();
      const linkRenderer = renderer.link;
      renderer.link = (href, title, text) => {
        const is_local_link =
          href.startsWith(`${location.protocol}//${location.hostname}`) ||
          href.startsWith("/");
        const html = linkRenderer.call(renderer, href, title, text);
        return is_local_link
          ? html
          : html.replace(
              /^<a /,
              `<a rel="noreferrer noopener nofollow" target="_blank" `
            );
      };

      let _list_of_images = [];

      const headingRenderer = renderer.heading;
      renderer.heading = (text, level) => {
        if (level === 5) {
          const fragments = this.corpora_data.filter(
            (fragment) =>
              fragment.collections &&
              fragment.collections.some((c) => c.startsWith(text))
          );
          let html = fragments.reduce((acc, f) => {
            const title = "<i>" + f.title + "</i><br>";

            let cont = "<div>";
            if (f.authors_of_document)
              cont += `<span>${f.authors_of_document}</span>, `;
            if (f.year) cont += `<span>${f.year}</span>, `;
            if (f.type_of_document)
              cont += `<span>${f.type_of_document}</span>`;

            // if (f.caption) cont += `<li>${f.caption}</li>`;
            // if (f.origin_of_document)
            //   cont += `<li>${f.origin_of_document}</li>`;
            if (f.thumbs?.icon_src)
              cont += `<br>
                <a href="${this.getPDFFromThumb(
                  f.thumbs.icon_src
                )}" target="_blank">Télécharger le pdf</a>
              `;
            cont += "</div>";

            const id = "id" + Math.random().toString(16).slice(2);

            acc += `
            <button type="button" class="_collEntry" data-imageToDisplay="${id}">
                <img src="${f.thumbs?.icon_src}" />
                ${title}
                ${cont}
            </button>
          <hr>
            `;

            if (f.thumbs?.large_src && f.thumbs?.icon_src) {
              _list_of_images.push({
                id,
                large_src: f.thumbs.large_src,
                icon_src: f.thumbs.icon_src,
                title: "",
                text: title + cont,
              });
            }

            return acc;
          }, "");

          return `<div class="_corporaFiles">${html}</div>`;
        }
        const html = headingRenderer.call(renderer, text, level);
        return html;
      };

      const htmlRenderer = renderer.html;
      renderer.html = (html, block) => {
        if (html.startsWith("<iframe ")) {
          const id = "id" + Math.random().toString(16).slice(2);
          _list_of_images.push({
            id,
            iframe: html,
          });
          const html_to_insert = htmlRenderer.call(renderer, html, block);
          return `<span class="_hideIframe" data-imageToDisplay="${id}">${html_to_insert}</span>`;
        } else return htmlRenderer.call(renderer, html, block);
      };

      const imageRenderer = renderer.image;
      renderer.image = (href, title, text) => {
        let icon_src, large_src;
        if (href.includes(">")) {
          const srcs = href.split(">");
          icon_src = srcs[0];
          large_src = srcs[1];
        } else {
          icon_src = large_src = href;
        }
        const id = "id" + Math.random().toString(16).slice(2);

        _list_of_images.push({
          id,
          large_src,
          icon_src,
          title,
          text,
        });
        const html_image = imageRenderer.call(renderer, icon_src, title, text);
        return `<button type="button" data-imageToDisplay="${id}">${html_image}</button>`;
      };
      this.$emit("updateListOfImages", _list_of_images);

      marked.use({ renderer });

      const hooks = {
        postprocess(html) {
          return DOMPurify.sanitize(html, {
            ADD_TAGS: ["iframe", "svg"],
            ADD_ATTR: [
              "allow",
              "allowfullscreen",
              "frameborder",
              "scrolling",
              "target",
            ],
          });
        },
      };
      marked.use({ hooks });
      return marked.parse(this.text, { breaks: true });
    },
    active_btn_styles() {
      if (!this.currently_active_image) return "";
      return `
      button[data-imagetodisplay="${this.currently_active_image.id}"] img {
          mix-blend-mode: hard-light;
      }
      ._collEntry[data-imagetodisplay="${this.currently_active_image.id}"] {
        // background:var(--color-scipo) !important;
        border-left: 2px solid var(--color-scipo) !important;
      }
      `;
    },
  },
  methods: {
    interceptBtn($event) {
      const imagetodisplay = $event.target.dataset?.imagetodisplay;
      if (imagetodisplay) this.$emit("showImage", imagetodisplay);
    },
    scrollToBtn(id) {
      const btn = this.$refs.content.querySelector(
        `[data-imagetodisplay=${id}]`
      );
      if (!btn) return false;

      const scrollBox = this.$refs.content.closest("._textBox");
      // scrollBox.scrollTo(0, btn.offsetTop - this.scroll_view_margin_top);
      scrollBox.scrollTo({
        top: btn.offsetTop - this.scroll_view_margin_top,
        left: 0,
        behavior: "instant",
      });
    },
    getPDFFromThumb(thumb_path) {
      // debugger;
      // return thumb_path;
      if (thumb_path) {
        if (/.pdf/.test(thumb_path))
          return thumb_path
            .substring(0, thumb_path.indexOf(".pdf") + 4)
            .replace(/^.*_thumbs\/shaping-ai\//, "pdfs/");
        else return thumb_path.replace(/^.*_thumbs\/shaping-ai\//, "pdfs/");
      }
      return "";
    },
    onScroll() {
      const btns = Array.from(
        this.$refs.content.querySelectorAll(`[data-imagetodisplay]`)
      );
      const scrollTop = this.$el.scrollTop + this.scroll_view_margin_top;

      let min_dist = 1_000_000;
      let closest_index = 0;
      btns.map((btn, index) => {
        const dist = Math.abs(
          btn.offsetTop + btn.offsetLeft / 10_000 - scrollTop
        );
        if (dist < min_dist) {
          closest_index = index;
          min_dist = dist;
        }
      });
      const btn = btns[closest_index];

      const imagetodisplay = btn.dataset?.imagetodisplay;
      /*
      console.log("btn to show", imagetodisplay);
      console.log(
        "this.currently_active_image.id",
        this.currently_active_image?.id
      );
      */
      if (imagetodisplay !== this.currently_active_image?.id)
        this.$emit("showImage", imagetodisplay);
    },
  },
};
</script>
<style lang="scss" scoped>
._textBox {
  height: 100%;
  overflow: auto;
  scroll-behavior: smooth;
}
._textBox--content {
  // padding: 1em;
  max-width: 70ch;
  padding: 0 calc(var(--spacing) * 4.5);

  ::v-deep {
    button {
      appearance: none;
      outline: none;
      background: transparent;
      border-radius: 0;
      // border: 2px solid var(--body-bg);
      background: var(--color-scipo);
      border-radius: 2px;
      padding: 0;
      vertical-align: bottom;

      cursor: pointer;
      transition: transform 0.1s ease-out;

      &:hover {
        // transform: scale(1.1);
      }

      img {
        display: block;
        pointer-events: none;

        width: auto;
        height: 2.2em;
      }
    }
    summary {
      cursor: pointer;
    }
    iframe {
      border: 2px solid var(--body-bg);
    }
    ._hideIframe {
      width: 0px;
      height: 0px;
      overflow: hidden;
      display: block;
    }

    ._corporaFiles {
      margin: 1em 0;
      font-size: 80%;
      > ._collEntry {
        width: 100%;
        padding-left: calc(var(--spacing) / 2);
        text-align: left;
        // border: 2px solid var(--body-bg);
        // padding: 0.5em;
        // margin-bottom: 2px;
        // border: 2px solid var(--body-bg);
        background: transparent;

        > * {
          pointer-events: none;
        }
        a {
          pointer-events: auto;
        }
      }

      img {
        width: 2em;
        height: 2em;
        object-fit: scale-down;
      }
    }
  }
}

._menu {
  font-size: 90%;

  position: sticky;
  top: 0;
  display: flex;
  padding: 0;
  gap: 1em;
  padding: calc(var(--spacing) * 1) calc(var(--spacing) * 4.5);
  margin-top: calc(var(--spacing) * 1);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(1px);
  background: linear-gradient(
    to bottom,
    rgb(255, 255, 255) 1em,
    rgba(255, 255, 255, 0.8) 100%
  );

  a {
    padding: 1em 0;
  }
}
</style>
