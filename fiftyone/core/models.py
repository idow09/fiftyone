"""
FiftyOne models.

| Copyright 2017-2020, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""
import eta.core.image as etai
import eta.core.learning as etal
import eta.core.video as etav

import fiftyone.core.media as fom
import fiftyone.core.utils as fou


def apply_model(samples, model, label_field, confidence_thresh=None):
    """Applies the :class:`Model` to the samples in the collection.

    Args:
        samples: a :class:`fiftyone.core.collections.SampleCollection`
        model: a :class:`Model`
        label_field: the name (or prefix) of the field in which to store the
            model predictions
        confidence_thresh (None): an optional confidence threshold to apply to
            any applicable labels generated by the model
    """
    if samples.media_type == fom.VIDEO:
        _apply_video_model(samples, model, label_field, confidence_thresh)
    else:
        _apply_image_model(samples, model, label_field, confidence_thresh)


def _apply_image_model(samples, model, label_field, confidence_thresh):
    if not isinstance(model, ImageModel):
        raise ValueError(
            "Model must be a subclass of %s in order to process images"
            % ImageModel
        )

    # Use data loaders for Torch models, if possible
    if isinstance(model, TorchModelMixin):
        # Local import to avoid unnecessary Torch dependency
        import fiftyone.utils.torch as fout

        fout.apply_torch_image_model(
            samples, model, label_field, confidence_thresh=confidence_thresh
        )

    with model:
        with fou.ProgressBar() as pb:
            for sample in pb(samples):
                # Perform prediction
                img = etai.read(sample.filepath)
                label = model.predict(img)

                # Save labels
                sample.add_labels(
                    label, label_field, confidence_thresh=confidence_thresh
                )


def _apply_video_model(samples, model, label_field, confidence_thresh):
    if not isinstance(model, VideoModel):
        raise ValueError(
            "Model must be a subclass of %s in order to process videos"
            % VideoModel
        )

    with model:
        with fou.ProgressBar() as pb:
            for sample in pb(samples):
                # Perform prediction
                with etav.FFmpegVideoReader(sample.filepath) as video_reader:
                    label = model.predict(video_reader)

                # Save labels
                sample.add_labels(
                    label, label_field, confidence_thresh=confidence_thresh
                )


class ModelConfig(etal.ModelConfig):
    """Base configuration class that encapsulates the name of a :class:`Model`
    and an instance of its associated Config class.

    Args:
        type: the fully-qualified class name of the :class:`Model` subclass
        config: an instance of the Config class associated with the model
    """

    pass


class Model(etal.Model):
    """Abstract base class for all models.

    This class declares the following conventions:

    (a)     :meth:`Model.__init__` should take a single `config` argument that
            is an instance of `<ModelClass>Config`

    (b)     Models implement the context manager interface. This means that
            models can optionally use context to perform any necessary setup
            and teardown, and so any code that builds a model should use the
            ``with`` syntax

    Models that process images must support the following interface:

    -   The :meth:`predict` method must support processing
        images represented as uint8 numpy arrays (HWC)

    -   The :meth:`predict_all` method must support processing uint8 numpy
        image tensors (NHWC)

    Models that process videos must support the following interface:

    -   The :meth:

    """

    def predict(self, arg):
        """Peforms prediction on the given data.

        Args:
            arg: the data

        Returns:
            a :class:`fiftyone.core.labels.Label` instance containing the
            predictions
        """
        raise NotImplementedError("subclasses must implement predict()")

    def predict_all(self, args):
        """Performs prediction on the given iterable of data.

        Subclasses can override this method to increase efficiency, but, by
        default, this method simply iterates over the data and applies
        :meth:`predict` to each.

        Args:
            args: an iterable of data

        Returns:
            a list of :class:`fiftyone.core.labels.Label` instances containing
            the predictions
        """
        return [self.predict(arg) for arg in args]


class ImageModel(Model):
    """Abstract base class for models that process images."""

    def predict(self, img):
        """Peforms prediction on the given image.

        Args:
            img: an image stored as a uint8 numpy array (HWC)

        Returns:
            a :class:`fiftyone.core.labels.Label` instance containing the
            predictions
        """
        raise NotImplementedError("subclasses must implement predict()")

    def predict_all(self, imgs):
        """Performs prediction on the given tensor of images.

        Subclasses can override this method to increase efficiency, but, by
        default, this method simply iterates over the images and applies
        :meth:`predict` to each.

        Args:
            imgs: a tensor of images stored as a uint8 numpy array (NHWC)

        Returns:
            a list of :class:`fiftyone.core.labels.Label` instances containing
            the predictions for each image
        """
        return [self.predict(img) for img in imgs]


class VideoModel(Model):
    """Abstract base class for models that process videos."""

    def predict(self, video_reader):
        """Peforms prediction on the given video.

        Args:
            video_reader: an ``eta.core.video.VideoReader``

        Returns:
            a :class:`fiftyone.core.labels.Label` instance containing the
            predictions
        """
        raise NotImplementedError("subclasses must implement predict()")

    def predict_all(self, video_readers):
        """Performs prediction on the given videos.

        Subclasses can override this method to increase efficiency, but, by
        default, this method simply iterates over the videos and applies
        :meth:`predict` to each.

        Args:
            video_readers: a list of ``eta.core.video.VideoReader`` instances

        Returns:
            a list of :class:`fiftyone.core.labels.Label` instances containing
            the predictions for each image
        """
        return [self.predict(video_reader) for video_reader in video_readers]


class TorchModelMixin(object):
    """Mixin for Torch models that support feeding data for nference via a
    ``torch.utils.data.DataLoader``.
    """

    @property
    def batch_size(self):
        """The recommended batch size to use when feeding data to the model,
        or ``None`` if batching is not supported.
        """
        raise NotImplementedError("subclasses must implement batch_size")

    @property
    def transforms(self):
        """The ``torchvision.transforms`` that will/must be applied to each
        input before prediction.
        """
        raise NotImplementedError("subclasses must implement transforms")
