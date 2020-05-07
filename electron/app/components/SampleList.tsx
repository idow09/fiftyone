import React, { useState } from "react";
import {
  Header,
  Icon,
  Menu,
  Message,
  Segment,
  Sidebar,
} from "semantic-ui-react";
import Gallery from "react-grid-gallery";
import InfiniteScroll from "react-infinite-scroller";
import { Dimmer, Image, Loader } from "semantic-ui-react";

import { updateState } from "../actions/update";
import { getSocket, useSubscribe } from "../utils/socket";
import connect from "../utils/connect";

const GalleryImage = (props) => {
  return <img {...props.imageProps} />;
};

const GalleryWrapper = connect((props) => {
  const { images, dispatch, state } = props;
  const socket = getSocket("state");
  return (
    <div style={{ overflowY: "auto" }}>
      <Gallery
        enableImageSelection={true}
        onSelectImage={function (idx, item) {
          item.isSelected = !item.isSelected;
          const event = item.isSelected ? "add_selection" : "remove_selection";
          socket.emit(event, item.sample._id.$oid, (data) => {
            dispatch(updateState(data));
          });
        }}
        thumbnailImageComponent={GalleryImage}
        tagStyle={{ display: "none" }}
        {...props}
      />
    </div>
  );
});

function SampleList(props) {
  const { state } = props;
  const hasDataset = Boolean(state && state.dataset);
  const socket = getSocket("state");
  const [scrollState, setScrollState] = useState({
    initialLoad: true,
    hasMore: true,
    images: [],
    pageToLoad: 1,
  });
  function createImages(samples) {
    return samples
      ? Object.keys(samples).map((k) => {
          const sample = samples[k];
          const path = sample.filepath;
          const mimeType = sample.metadata.mime_type;
          const host = "http://127.0.0.1:5151/";
          const src = `${host}?path=${path}&mime_type=${mimeType}`;
          return {
            src: src,
            thumbnail: src,
            thumbnailWidth: samples[k].metadata.width,
            thumbnailHeight: samples[k].metadata.height,
            tags: [{ value: null, title: "title" }],
            sample: sample,
          };
        })
      : [];
  }
  const loadMore = () => {
    if (hasDataset) {
      socket.emit("page", scrollState.pageToLoad, (data) => {
        console.log(data);
        const more = createImages(data);
        setScrollState({
          initialLoad: false,
          hasMore: scrollState.pageToLoad * 20 < state.count,
          images: [...scrollState.images, ...more],
          pageToLoad: scrollState.pageToLoad + 1,
        });
      });
    } else {
      setScrollState({
        initialLoad: true,
        hasMore: false,
        images: [],
        pageToLoad: 1,
      });
    }
  };
  useSubscribe(socket, "update", (data) => {
    setScrollState({
      iniitialLoad: true,
      hasMore: true,
      images: [],
      pageToLoad: 1,
    });
  });
  if (!hasDataset) {
    return (
      <Segment>
        <Message>No dataset loaded</Message>
      </Segment>
    );
  }
  const content = <GalleryWrapper images={scrollState.images} />;
  return (
    <>
      <InfiniteScroll
        pageStart={1}
        initialLoad={true}
        loadMore={() => loadMore()}
        hasMore={scrollState.hasMore}
        loader={<Loader />}
        useWindow={true}
      >
        {content}
      </InfiniteScroll>
      {scrollState.hasMore ? <Loader /> : "End of list"}
    </>
  );
}

export default connect(SampleList);
