import React, { useState, useEffect } from "react";
import {
    FormStep,
    UploadFile,
    CardLabel
} from "@egovernments/digit-ui-react-components";

const OCUploadPlanDiagram = ({ t, config, onSelect, userType, formData, ownerIndex = 0, addNewOwner, isShowToast }) => {
    const tenantId = Digit.ULBService.getCurrentTenantId();
    const stateId = tenantId.split(".")[0];
    const [uploadedFile, setUploadedFile] = useState(() => formData?.uploadData?.file || null);
    const [file, setFile] = useState(formData?.uploadData?.file);
    const [uploadMessage, setUploadMessage] = useState("");

    function selectfile(e) {
        setUploadedFile(e.target.files[0]);
        setFile(e.target.files[0]);
    }

    const onSkip = () => { };

    useEffect(() => {
        if (uploadMessage) {
            setUploadedFile(null);
            setFile("");
            setUploadMessage("");
        }
    }, [uploadMessage]);

    function onAdd() { };

    const handleSubmit = () => {
        const data = {};
        data.file = file;
        onSelect(config.key, data, true, true);
    };

    return (
        <FormStep
            t={t}
            config={config}
            onSelect={handleSubmit}
            onSkip={onSkip}
            isDisabled={!file}
            onAdd={onAdd}
            isMultipleAllow={true}
        >
            <CardLabel>{`${t("BPA_OC_PLAN_DIAGRAM_DXF")}*`}</CardLabel>
            <UploadFile
                extraStyleName={"propertyCreate"}
                accept=".dxf"
                onUpload={selectfile}
                onDelete={() => {
                    setUploadedFile(null);
                    setFile("");
                }}
                message={uploadedFile ? `1 ${t(`PT_ACTION_FILEUPLOADED`)}` : t(`ES_NO_FILE_SELECTED_LABEL`)}
                uploadMessage={uploadMessage}
            />
            <div style={{ disabled: "true", height: "30px", width: "100%", fontSize: "14px" }}></div>
        </FormStep>
    );
};

export default OCUploadPlanDiagram;
