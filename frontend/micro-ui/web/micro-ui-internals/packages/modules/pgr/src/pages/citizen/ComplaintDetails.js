import React, { useEffect, useState, Fragment } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import StarRated from "../../../src/components/timelineInstances/StarRated";

import { LOCALIZATION_KEY } from "../../constants/Localization";

import {
  Card,
  Header,
  CardSubHeader,
  StatusTable,
  Row,
  TextArea,
  SubmitBar,
  DisplayPhotos,
  ImageViewer,
  Loader,
  Toast,
  ConnectingCheckPoints,
  CheckPoint
} from "@egovernments/digit-ui-react-components";

import TimeLine from "../../components/TimeLine";

const WorkflowComponent = ({ complaintDetails, id, getWorkFlow, zoomImage, t }) => {
  const tenantId = complaintDetails.service.tenantId;
  const workflowDetails = Digit.Hooks.useWorkflowDetails({ tenantId: tenantId, id, moduleCode: "PGR" });
  useEffect(() => {
    getWorkFlow(workFlowDetails.data);
  }, [workFlowDetails.data]);

  useEffect(() => {
    workflowDetails.revalidate();
  }, []);

  const TLCaption = ({ data, comments }) => { 
    const { t } = useTranslation()
    return (
      <div>
        {data?.date && <p>{data?.date}</p>}
        <p>{data?.name}</p>
        <p>{data?.mobileNumber}</p>
        {data?.source && <p>{t("ES_COMMON_FILED_VIA_" + data?.source.toUpperCase())}</p>}
        {comments?.map( e => 
          <div className="TLComments">
            <h3>{t("WF_COMMON_COMMENTS")}</h3>
            <p>{e}</p>
          </div>
        )}
      </div>
    );
  };

  const getTimelineCaptions = (checkpoint, index, arr) => {
    const {wfComment: comment, thumbnailsToShow} = checkpoint;
    function zoomImageTimeLineWrapper(imageSource, index,thumbnailsToShow){
      let newIndex=thumbnailsToShow.thumbs?.findIndex(link=>link===imageSource);
      zoomImage((newIndex>-1&&thumbnailsToShow?.fullImage?.[newIndex])||imageSource);
    }
    const captionForOtherCheckpointsInTL = {
      date: checkpoint?.auditDetails?.lastModified,
      name: checkpoint?.assigner?.name,
      mobileNumber: checkpoint?.assigner?.mobileNumber,
      ...checkpoint.status === "COMPLAINT_FILED" && complaintDetails?.audit ? {
        source: complaintDetails.audit.source,
      } : {}
    }
    const isFirstPendingForAssignment = arr.length - (index + 1) === 1 ? true : false;
    if (checkpoint.status === "PENDINGFORASSIGNMENT" && complaintDetails?.audit) {
      if(isFirstPendingForAssignment){
        const caption = {
          date: Digit.DateUtils.ConvertTimestampToDate(complaintDetails.audit.details.createdTime),
        };
        return <TLCaption data={caption} comments={checkpoint?.wfComment}/>;
      } else {
        const caption = {
          date: Digit.DateUtils.ConvertTimestampToDate(complaintDetails.audit.details.createdTime),
        };
        return <>
          <div>
          {checkpoint?.wfComment ? <div>{checkpoint?.wfComment?.map( e => 
            <div className="TLComments">
              <h3>{t("WF_COMMON_COMMENTS")}</h3>
              <p>{e}</p>
            </div>
          )}</div> : null}
          {checkpoint.status !== "COMPLAINT_FILED" && thumbnailsToShow?.thumbs?.length > 0 ? <div className="TLComments">
            <h3>{t("CS_COMMON_ATTACHMENTS")}</h3>
            <DisplayPhotos srcs={thumbnailsToShow.thumbs} onClick={(src, index) => zoomImageTimeLineWrapper(src, index,thumbnailsToShow)} />
          </div> : null}
          {caption?.date ? <TLCaption data={caption}/> : null}
          </div>
        </>
      }
    }
    // return (checkpoint.caption && checkpoint.caption.length !== 0) || checkpoint?.wfComment?.length > 0 ? <TLCaption data={checkpoint?.caption?.[0]} comments={checkpoint?.wfComment} /> : null;
    return <>
      {comment ? <div>{comment?.map( e => 
        <div className="TLComments">
          <h3>{t("WF_COMMON_COMMENTS")}</h3>
          <p>{e}</p>
        </div>
      )}</div> : null}
      {checkpoint.status !== "COMPLAINT_FILED" && thumbnailsToShow?.thumbs?.length > 0 ? <div className="TLComments">
        <h3>{t("CS_COMMON_ATTACHMENTS")}</h3>
        <DisplayPhotos srcs={thumbnailsToShow.thumbs} onClick={(src, index) => zoomImageTimeLineWrapper(src, index,thumbnailsToShow)} />
      </div> : null}
      {captionForOtherCheckpointsInTL?.date ? <TLCaption data={captionForOtherCheckpointsInTL}/> : null}
      {(checkpoint?.status === "RESOLVED" && complaintDetails?.workflow?.action === "RATE") && complaintDetails.audit.rating ? <StarRated text={t("CS_ADDCOMPLAINT_YOU_RATED")} rating={complaintDetails.audit.rating} />: null}
      {/* {(checkpoint.status == "REJECTED" && complaintDetails.workflow.action == "RATE") && complaintDetails.audit.rating ? <StarRated text={t("CS_ADDCOMPLAINT_YOU_RATED")} rating={complaintDetails.audit.rating} />: null} */}
    </>
  }

  return (
    !workflowDetails.isLoading && (
      <div>
        {!workflowDetails?.isLoading && (
          <React.Fragment>
            <CardSubHeader>{t(`CS_COMPLAINT_DETAILS_COMPLAINT_TIMELINE`)}</CardSubHeader>

            {workflowDetails?.data?.timeline && workflowDetails?.data?.timeline?.length === 1 ? (
              <CheckPoint isCompleted={true} label={t("CS_COMMON_" + workflowDetails?.data?.timeline[0]?.status)} />
            ) : (
              <ConnectingCheckPoints>
                {workflowDetails?.data?.timeline &&
                  workflowDetails?.data?.timeline.map((checkpoint, index, arr) => {
                    return (
                      <React.Fragment key={index}>
                        <CheckPoint
                          keyValue={index}
                          isCompleted={index === 0}
                          label={t("CS_COMMON_" + checkpoint.status)}
                          customChild={getTimelineCaptions(checkpoint, index, arr)}
                        />
                      </React.Fragment>
                    );
                  })}
              </ConnectingCheckPoints>
            )}
          </React.Fragment>
        )}
      </div>
    )
  );
};

const ComplaintDetailsPage = (props) => {
  let { t } = useTranslation();
  let { id } = useParams();

  let tenantId = Digit.ULBService.getCurrentTenantId(); // ToDo: fetch from state
  const { isLoading, error, isError, complaintDetails, revalidate } = Digit.Hooks.pgr.useComplaintDetails({ tenantId, id });

  const [imageShownBelowComplaintDetails, setImageToShowBelowComplaintDetails] = useState({});

  const [imageZoom, setImageZoom] = useState(null);

  const [comment, setComment] = useState("");

  const [toast, setToast] = useState(false);

  const [commentError, setCommentError] = useState(null);

  const [disableComment, setDisableComment] = useState(true);

  const [loader, setLoader] = useState(false);

  useEffect(() => {
    (async () => {
      if (complaintDetails) {
        setLoader(true);
        await revalidate();
        setLoader(false);
      }
    })();
  }, []);

  function zoomImage(imageSource, index) {
    setImageZoom(imageSource);
  }
  function zoomImageWrapper(imageSource, index) {
    zoomImage(imageShownBelowComplaintDetails?.fullImage[index]);
  }

  function onCloseImageZoom() {
    setImageZoom(null);
  }

  const onWorkFlowChange = (data) => {
    let timeline = data?.timeline;
    timeline && timeline[0].timeLineActions?.filter((e) => e === "COMMENT").length ? setDisableComment(false) : setDisableComment(true);
    if (timeline) {
      const actionByCitizenOnComplaintCreation = timeline.find((e) => e?.performedAction === "APPLY");
      const { thumbnailsToShow } = actionByCitizenOnComplaintCreation;
      setImageToShowBelowComplaintDetails(thumbnailsToShow);
    }
  };

  const submitComment = async () => {
    let detailsToSend = { ...complaintDetails };
    delete detailsToSend.audit;
    delete detailsToSend.details;
    detailsToSend.workflow = { action: "COMMENT", comments: comment };
    let tenantId = Digit.ULBService.getCurrentTenantId();
    try {
      setCommentError(null);
      const res = await Digit.PGRService.update(detailsToSend, tenantId);
      if (res.ServiceWrappers.length) setComment("");
      else throw true;
    } catch (er) {
      setCommentError(true);
    }
    setToast(true);
    setTimeout(() => {
      setToast(false);
    }, 30000);
  };

  if (isLoading || loader) {
    return <Loader />;
  }

  if (isError) {
    return <h2>Error</h2>;
  }

  return (
    <React.Fragment>
      <div className="complaint-summary">
        <Header>{t(`${LOCALIZATION_KEY.CS_HEADER}_COMPLAINT_SUMMARY`)}</Header>

        {Object.keys(complaintDetails).length > 0 ? (
          <React.Fragment>
            <Card>
              <CardSubHeader>{t(`SERVICEDEFS.${complaintDetails.audit.serviceCode.toUpperCase()}`)}</CardSubHeader>
              <StatusTable>
                {Object.keys(complaintDetails.details).map((flag, index, arr) => (
                  <Row
                    key={index}
                    label={t(flag)}
                    text={
                      Array.isArray(complaintDetails.details[flag])
                        ? complaintDetails.details[flag].map((val) => (typeof val === "object" ? t(val?.code) : t(val)))
                        : t(complaintDetails.details[flag]) || "N/A"
                    }
                    last={index === arr.length - 1}
                  />
                ))}
              </StatusTable>
              {imageShownBelowComplaintDetails?.thumbs ? (
                <DisplayPhotos srcs={imageShownBelowComplaintDetails?.thumbs} onClick={(source, index) => zoomImageWrapper(source, index)} />
              ) : null}
              {imageZoom ? <ImageViewer imageSrc={imageZoom} onClose={onCloseImageZoom} /> : null}
            </Card>
            <Card>
              {complaintDetails?.service && (
                <WorkflowComponent getWorkFlow={onWorkFlowChange} complaintDetails={complaintDetails} id={id} zoomImage={zoomImage} t={t}/>
              )}
            </Card>
            {/* <Card>
      <CardSubHeader>{t(`${LOCALIZATION_KEY.CS_COMMON}_COMMENTS`)}</CardSubHeader>
      <TextArea value={comment} onChange={(e) => setComment(e.target.value)} name="" />
      <SubmitBar disabled={disableComment || comment.length < 1} onSubmit={submitComment} label={t("CS_PGR_SEND_COMMENT")} />
    </Card> */}
            {toast && (
              <Toast
                error={commentError}
                label={!commentError ? t(`CS_COMPLAINT_COMMENT_SUCCESS`) : t(`CS_COMPLAINT_COMMENT_ERROR`)}
                onClose={() => setToast(false)}
              />
            )}{" "}
          </React.Fragment>
        ) : (
          <Loader />
        )}
      </div>
    </React.Fragment>
  );
};

export default ComplaintDetailsPage;
