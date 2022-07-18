package org.egov.swservice.workflow;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.egov.common.contract.request.PlainAccessRequest;
import org.egov.common.contract.request.RequestInfo;
import org.egov.common.contract.request.User;
import org.egov.swservice.config.SWConfiguration;
import org.egov.swservice.repository.ServiceRequestRepository;
import org.egov.swservice.util.EncryptionDecryptionUtil;
import org.egov.swservice.web.models.RequestInfoWrapper;
import org.egov.swservice.web.models.SewerageConnection;
import org.egov.swservice.web.models.workflow.BusinessService;
import org.egov.swservice.web.models.workflow.BusinessServiceResponse;
import org.egov.swservice.web.models.workflow.ProcessInstance;
import org.egov.swservice.web.models.workflow.ProcessInstanceResponse;
import org.egov.swservice.web.models.workflow.State;
import org.egov.tracer.model.CustomException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.ObjectUtils;

@Service
public class WorkflowService {

	private SWConfiguration config;

	private ServiceRequestRepository serviceRequestRepository;

	private ObjectMapper mapper;

	@Autowired
	EncryptionDecryptionUtil encryptionDecryptionUtil;

	@Autowired
	public WorkflowService(SWConfiguration config, ServiceRequestRepository serviceRequestRepository,
			ObjectMapper mapper) {
		this.config = config;
		this.serviceRequestRepository = serviceRequestRepository;
		this.mapper = mapper;
	}

	/**
	 * Get the workflow-config for the given tenant
	 * 
	 * @param tenantId
	 *            The tenantId for which businessService is requested
	 * @param requestInfo
	 *            The RequestInfo object of the request
	 * @return BusinessService for the the given tenantId
	 */
	public BusinessService getBusinessService(String businessServiceId, String tenantId, RequestInfo requestInfo) {
		Object result = serviceRequestRepository.fetchResult(getSearchURLWithParams(businessServiceId, tenantId), 
				RequestInfoWrapper.builder().requestInfo(requestInfo).build());
		BusinessServiceResponse response;
		try {
			response = mapper.convertValue(result, BusinessServiceResponse.class);
		} catch (IllegalArgumentException e) {
			throw new CustomException("PARSING_ERROR", "Failed to parse response of calculate");
		}
		return response.getBusinessServices().get(0);
	}

	/**
	 * Creates url for search based on given tenantId
	 *
	 * @param tenantId
	 *            The tenantId for which url is generated
	 * @return The search url
	 */
	private StringBuilder getSearchURLWithParams(String businessServiceId, String tenantId) {
		StringBuilder url = new StringBuilder(config.getWfHost());
		url.append(config.getWfBusinessServiceSearchPath());
		url.append("?tenantId=");
		url.append(tenantId);
		url.append("&businessServices=");
		url.append(businessServiceId);
		return url;
	}

	/**
	 * Returns boolean value to specifying if the state is updatable
	 * 
	 * @param stateCode
	 *            The stateCode of the license
	 * @param businessService
	 *            The BusinessService of the application flow
	 * @return State object to be fetched
	 */
	public Boolean isStateUpdatable(String stateCode, BusinessService businessService) {
		for (State state : businessService.getStates()) {
			if (state.getApplicationStatus() != null && state.getApplicationStatus().equalsIgnoreCase(stateCode))
				return state.getIsStateUpdatable();
		}
		return null;
	}
	
	/**
	    * Return sla based on state code
	    * 
	    * @param tenantId - Tenant Id
	    * @param requestInfo - Request Info Object
	    * @param stateCode - State Code
	    * @return no of days for sla
	    */
		public BigDecimal getSlaForState(String businessServiceId, String tenantId, RequestInfo requestInfo, String stateCode) {
			BusinessService businessService = getBusinessService(businessServiceId, tenantId, requestInfo);
			return new BigDecimal(businessService.getStates().stream().filter(state -> state.getApplicationStatus() != null
					&& state.getApplicationStatus().equalsIgnoreCase(stateCode)).map(state -> {
						if (state.getSla() == null) {
							return 0L;
						}
						return state.getSla();
					}).findFirst().orElse(0L));
		}
		
		/**
		 * Get the workflow processInstance for the given tenant
		 * 
		 * @param tenantId
		 *            The tenantId for which businessService is requested
		 * @param requestInfo
		 *            The RequestInfo object of the request
		 * @param businessServiceValue - Name of the Business Service
		 * @return List<ProcessInstance> - List of Process instance for the given ApplicationNo
		 */
		public List<ProcessInstance> getProcessInstance(RequestInfo requestInfo, String applicationNo, String tenantId, String businessServiceValue) {
			StringBuilder url = getProcessInstanceSearchURL(tenantId, applicationNo, businessServiceValue);
			RequestInfoWrapper requestInfoWrapper = RequestInfoWrapper.builder().requestInfo(requestInfo).build();
			Object result = serviceRequestRepository.fetchResult(url, requestInfoWrapper);

			PlainAccessRequest apiPlainAccessRequest = requestInfo.getPlainAccessRequest();
			List<String> plainRequestFieldsList = new ArrayList<String>() {{
				add("mobileNumber");
			}};

			ProcessInstanceResponse response;
			try {
				response = mapper.convertValue(result, ProcessInstanceResponse.class);
				if(response.getProcessInstances() !=null){
					if(response.getProcessInstances().get(0).getAssignes()!=null) {
						PlainAccessRequest plainAccessRequest = PlainAccessRequest.builder().recordId(response.
										getProcessInstances().get(0).getAssignes().get(0).getUuid())
								.plainRequestFields(plainRequestFieldsList).build();

						requestInfo.setPlainAccessRequest(plainAccessRequest);
						requestInfoWrapper = RequestInfoWrapper.builder().requestInfo(requestInfo).build();
					}
				}
				Object resultNew = serviceRequestRepository.fetchResult(url, requestInfoWrapper);
				response = mapper.convertValue(resultNew, ProcessInstanceResponse.class);
				requestInfo.setPlainAccessRequest(apiPlainAccessRequest);
			} catch (IllegalArgumentException e) {
				throw new CustomException("PARSING_ERROR", "Failed to parse response of process instance");
			}

			if (!ObjectUtils.isEmpty(response.getProcessInstances())) {
				Optional<ProcessInstance> processInstance = response.getProcessInstances().stream().findFirst();
				if(processInstance.get().getAssignes()!=null) {
					/* encrypt here */
					processInstance.get().setAssignes((List<org.egov.common.contract.request.User>) encryptionDecryptionUtil.encryptObject(processInstance.get().getAssignes(), "WaterConnectionOwner", User.class));

					/* decrypt here */
					processInstance.get().setAssignes(encryptionDecryptionUtil.decryptObject(processInstance.get().getAssignes(), "WaterConnectionOwner", User.class, requestInfo));
				}
				List<ProcessInstance> processInstanceList = new ArrayList<>();
				processInstanceList.add(processInstance.get());
				return processInstanceList;
			}
			return null;
			//return response.getProcessInstances();
		}
		/**
		 * 
		 * @param tenantId - Tenant Id
		 * @param applicationNo - Application Number
		 * @param businessServiceValue - Name of the Business Service
		 * @return - Returns URL to get the ProcessInstance
		 */
		private StringBuilder getProcessInstanceSearchURL(String tenantId, String applicationNo, String businessServiceValue) {
			StringBuilder url = new StringBuilder(config.getWfHost());
			url.append(config.getWfProcessSearchPath());
			url.append("?tenantId=");
			url.append(tenantId);
			if(businessServiceValue!=null) {
				url.append("&businessServices=");
				url.append(businessServiceValue);
			}
			url.append("&businessIds=");
			url.append(applicationNo);
			return url;
		}
		/**
		 * 
		 * @param requestInfo - Request Info Object
		 * @param applicationNo - Application Number
		 * @param tenantId  - Tenant Id
		 * @return - Returns the Application Status value
		 */
		public String getApplicationStatus(RequestInfo requestInfo, String applicationNo, String tenantId, String businessServiceValue) {
			List<ProcessInstance> processInstanceList = getProcessInstance(requestInfo, applicationNo, tenantId, businessServiceValue);
			Optional<ProcessInstance> processInstance = processInstanceList.stream().findFirst();
			return processInstance.get().getState().getApplicationStatus();
		}
		
		/**
		 *
		 * @param sewerageConnectionList
		 * @param requestInfo
		 * @param tenantId
		 */
		public void validateInProgressWF(List<SewerageConnection> sewerageConnectionList, RequestInfo requestInfo,
										 String tenantId) {
			Set<String> applicationNos = sewerageConnectionList.stream().map(SewerageConnection::getApplicationNo).collect(Collectors.toSet());
			String applicationNosURLConst = applicationNos.stream().collect(Collectors.joining(","));
			List<ProcessInstance> processInstanceList = getProcessInstance(requestInfo, applicationNosURLConst, tenantId, config.getModifySWBusinessServiceName());
			processInstanceList.forEach(processInstance -> {
				if (!processInstance.getState().getIsTerminateState()) {
					throw new CustomException("SW_APP_EXIST_IN_WF",
							"Application already exist in WorkFlow. Cannot modify connection.");
				}
			});
		}

}
