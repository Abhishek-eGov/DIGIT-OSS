import { httpRequest } from "./api";
import envVariables from "../envVariables";

export default async (requestInfo = {},tenantId, header) => {
  let headers;
  if(envVariables.IS_ENVIRONMENT_CENTRAL_INSTANCE){
    header['tenantId']=header.tenantid;
  }
  headers = header;
 
  var requestBody = {
    RequestInfo: requestInfo,
    MdmsCriteria: {
      tenantId,
      moduleDetails: [
        {
          moduleName: "common-masters",
          masterDetails: [{ name: "OwnerType" }, { name: "OwnerShipCategory" }]
        },
        {
          moduleName: "firenoc",
          masterDetails: [
            { name: "BuildingType" },
            { name: "Documents" },
            { name: "FireStations" },
            { name: "UOMs" }
          ]
        },
        {
          moduleName: "egf-master",
          masterDetails: [{ name: "FinancialYear" }]
        },
        { moduleName: "tenant", masterDetails: [{ name: "tenants" }] }
      ]
    }
  };
  var mdmsResponse = await httpRequest({
    hostURL: envVariables.EGOV_MDMS_HOST,
    endPoint: `${envVariables.EGOV_MDMS_CONTEXT_PATH}${
      envVariables.EGOV_MDMS_SEARCH_ENPOINT
    }`,
    requestBody,
    headers
  });
  return mdmsResponse;
};
