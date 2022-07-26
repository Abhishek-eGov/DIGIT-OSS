package org.egov.swcalculation.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.egov.common.contract.request.RequestInfo;
import org.egov.swcalculation.constants.SWCalculationConstant;
import org.egov.swcalculation.util.CalculatorUtils;
import org.egov.swcalculation.web.models.*;
import org.egov.swcalculation.repository.SewerageCalculatorDao;
import org.egov.swcalculation.util.SWCalculationUtil;
import org.egov.tracer.model.CustomException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import lombok.extern.slf4j.Slf4j;

import static org.egov.swcalculation.constants.SWCalculationConstant.*;
import static org.egov.swcalculation.web.models.TaxHeadCategory.CHARGES;

@Service
@Slf4j
public class SWCalculationServiceImpl implements SWCalculationService {

	@Autowired
	private MasterDataService mDataService;

	@Autowired
	private EstimationService estimationService;

	@Autowired
	private PayService payService;

	@Autowired
	private DemandService demandService;

	@Autowired
	private SewerageCalculatorDao sewerageCalculatorDao;
	
	@Autowired
	private SWCalculationUtil sWCalculationUtil;

	@Autowired
	private CalculatorUtils util;


	@Autowired
	private ObjectMapper mapper;


	/**
	 * Get CalculationReq and Calculate the Tax Head on Sewerage Charge
	 * @param request  calculation request
	 * @return Returns the list of Calculation objects
	 */
	public List<Calculation> getCalculation(CalculationReq request) {
		List<Calculation> calculations;
		boolean connectionRequest = false;
		if (request.getDisconnectRequest()!= null && request.getDisconnectRequest()) {
			// Calculate and create demand for connection
			connectionRequest = request.getDisconnectRequest();
			Map<String, Object> masterMap = mDataService.loadMasterData(request.getRequestInfo(),
					request.getCalculationCriteria().get(0).getTenantId());
			calculations = getCalculations(request, masterMap);
			demandService.generateDemand(request.getRequestInfo(), calculations, masterMap, connectionRequest);
			unsetSewerageConnection(calculations);
		} else if (request.getIsconnectionCalculation()) {
			connectionRequest = request.getIsconnectionCalculation();
			Map<String, Object> masterMap = mDataService.loadMasterData(request.getRequestInfo(),
					request.getCalculationCriteria().get(0).getTenantId());
			calculations = getCalculations(request, masterMap);
			demandService.generateDemand(request.getRequestInfo(), calculations, masterMap, connectionRequest);
			unsetSewerageConnection(calculations);

		} else {
			// Calculate and create demand for application
			Map<String, Object> masterData = mDataService.loadExemptionMaster(request.getRequestInfo(),
					request.getCalculationCriteria().get(0).getTenantId());
			calculations = getFeeCalculation(request, masterData);
			demandService.generateDemand(request.getRequestInfo(), calculations, masterData,
					request.getIsconnectionCalculation());
			unsetSewerageConnection(calculations);
		}
		
		return calculations;
	}

	/**
	 * 
	 * @param requestInfo - Request Info
	 * @param criteria - Criteria
	 * @param estimatesAndBillingSlabs - List of estimates
	 * @param masterMap - MDMS Master Data
	 * @return - Returns Calculation object
	 * 
	 */
	public Calculation getCalculation(RequestInfo requestInfo, CalculationCriteria criteria,
			  Map<String, List> estimatesAndBillingSlabs, Map<String, Object> masterMap, boolean isConnectionFee, boolean isLastElementWithDisconnectionRequest) {

		@SuppressWarnings("unchecked")
		List<TaxHeadEstimate> estimates = estimatesAndBillingSlabs.get("estimates");
		@SuppressWarnings("unchecked")
		List<String> billingSlabIds = estimatesAndBillingSlabs.get("billingSlabIds");
		SewerageConnection sewerageConnection = criteria.getSewerageConnection();
		
		Property property = sWCalculationUtil.getProperty(SewerageConnectionRequest.builder()
				.sewerageConnection(sewerageConnection).requestInfo(requestInfo).build());

		String tenantId = null != property.getTenantId() ? property.getTenantId() : criteria.getTenantId();

		@SuppressWarnings("unchecked")
		Map<String, TaxHeadCategory> taxHeadCategoryMap = ((List<TaxHeadMaster>) masterMap
				.get(SWCalculationConstant.TAXHEADMASTER_MASTER_KEY)).stream()
						.collect(Collectors.toMap(TaxHeadMaster::getCode, TaxHeadMaster::getCategory, (OldValue, NewValue) -> NewValue));

		BigDecimal taxAmt = BigDecimal.ZERO;
		BigDecimal sewerageCharge = BigDecimal.ZERO;
		BigDecimal penalty = BigDecimal.ZERO;
		BigDecimal exemption = BigDecimal.ZERO;
		BigDecimal rebate = BigDecimal.ZERO;
		BigDecimal fee = BigDecimal.ZERO;

		if(isLastElementWithDisconnectionRequest) {
			if (sewerageConnection.getApplicationStatus().equalsIgnoreCase(SWCalculationConstant.PENDING_FOR_PAYMENT) ||
					sewerageConnection.getApplicationStatus().equalsIgnoreCase(SWCalculationConstant.CONNECTION_INACTIVATED)) {

				Map<String, Object> finalMap = new HashMap<>();

				List<SewerageConnection> sewerageConnectionList = util.getSewerageConnection(requestInfo, criteria.getConnectionNo(), requestInfo.getUserInfo().getTenantId());
				for (SewerageConnection connection : sewerageConnectionList) {
					if (connection.getApplicationType().equalsIgnoreCase(NEW_SEWERAGE_CONNECTION)) {
						Map<String, Object> bills = util.getBillData(requestInfo, requestInfo.getUserInfo().getTenantId(), connection.getApplicationNo());
						List<String> bill = (List<String>) bills.get(BILL_KEY);
						Map<String, String> billMap = mapper.convertValue(bill.get(0), Map.class);
						Double amount = 0.0;
						List<Map<String, String>> billDetails = mapper.convertValue(billMap.get(BILL_DETAILS_KEY), List.class);

						Collections.sort(billDetails, (l1, l2) -> {
							return new Long(l1.get(TO_PERIOD_KEY)).compareTo(new Long(l2.get(TO_PERIOD_KEY)));
						});
						finalMap = mapper.convertValue(billDetails.get(0), Map.class);
						Long billingPeriod = Long.parseLong(finalMap.get(TO_PERIOD_KEY).toString()) - Long.parseLong(finalMap.get(FROM_PERIOD_KEY).toString());
						BigDecimal finalSewerageCharge = sewerageCharge.add(BigDecimal.valueOf((Double.parseDouble(finalMap.get(AMOUNT_KEY).toString()) *
								(Double.parseDouble(finalMap.get(TO_PERIOD_KEY).toString()) - sewerageConnection.getDateEffectiveFrom())) / billingPeriod));
						estimates.stream().forEach(estimate -> {
							if (taxHeadCategoryMap.get(estimate.getTaxHeadCode()).equals(CHARGES)) {
								estimate.setEstimateAmount(finalSewerageCharge);
							}
						});
					}
				}

			}
		}

		for (TaxHeadEstimate estimate : estimates) {

			TaxHeadCategory category = taxHeadCategoryMap.get(estimate.getTaxHeadCode());
			estimate.setCategory(category);

			switch (category) {

			case CHARGES:
				sewerageCharge = sewerageCharge.add(estimate.getEstimateAmount());
				break;

			case PENALTY:
				penalty = penalty.add(estimate.getEstimateAmount());
				break;

			case REBATE:
				rebate = rebate.add(estimate.getEstimateAmount());
				break;

			case EXEMPTION:
				exemption = exemption.add(estimate.getEstimateAmount());
				break;

			case FEE:
				fee = fee.add(estimate.getEstimateAmount());
				break;

			default:
				taxAmt = taxAmt.add(estimate.getEstimateAmount());
				break;
			}
			
		}

		TaxHeadEstimate decimalEstimate = payService.roundOfDecimals(taxAmt.add(penalty).add(fee).add(sewerageCharge),
				rebate.add(exemption), isConnectionFee);
		if (null != decimalEstimate) {
			decimalEstimate.setCategory(taxHeadCategoryMap.get(decimalEstimate.getTaxHeadCode()));
			estimates.add(decimalEstimate);
			if (decimalEstimate.getEstimateAmount().compareTo(BigDecimal.ZERO) >= 0)
				taxAmt = taxAmt.add(decimalEstimate.getEstimateAmount());
			else
				rebate = rebate.add(decimalEstimate.getEstimateAmount());
		}

		BigDecimal totalAmount = taxAmt.add(penalty).add(rebate).add(exemption).add(sewerageCharge).add(fee);
		return Calculation.builder().totalAmount(totalAmount).taxAmount(taxAmt).penalty(penalty).exemption(exemption)
				.charge(sewerageCharge).fee(fee).sewerageConnection(sewerageConnection).rebate(rebate)
				.tenantId(criteria.getTenantId()).taxHeadEstimates(estimates).billingSlabIds(billingSlabIds)
				.connectionNo(criteria.getConnectionNo()).applicationNO(criteria.getApplicationNo()).build();
	}

	/**
	 * Generate Demand Based on Time (Monthly, Quarterly, Yearly)
	 */
	public void generateDemandBasedOnTimePeriod(RequestInfo requestInfo, BulkBillCriteria bulkBillCriteria) {
		DateTimeFormatter dateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
		LocalDateTime date = LocalDateTime.now();
		log.info("Time schedule start for sewerage demand generation on : " + date.format(dateTimeFormatter));
		
		List<String> tenantIds = new ArrayList<>();
		if(!CollectionUtils.isEmpty(bulkBillCriteria.getTenantIds())){
			tenantIds = bulkBillCriteria.getTenantIds();
		}
		else
			tenantIds = sewerageCalculatorDao.getTenantId();
		
		if (tenantIds.isEmpty())
			return;
		log.info("Tenant Ids : " + tenantIds);
		tenantIds.forEach(tenantId -> demandService.generateDemandForTenantId(tenantId, requestInfo, bulkBillCriteria));
	}

	/**
	 * 
	 * @param request
	 *            would be calculations request
	 * @param masterMap
	 *            master data
	 * @return all calculations including sewerage charge and taxhead on that
	 */
	public List<Calculation> getCalculations(CalculationReq request, Map<String, Object> masterMap) {
		List<Calculation> calculations = new ArrayList<>(request.getCalculationCriteria().size());
		for (CalculationCriteria criteria : request.getCalculationCriteria()) {
			Map<String, List> estimationMap = estimationService.getEstimationMap(criteria, request.getRequestInfo(),
					masterMap);
			ArrayList<?> billingFrequencyMap = (ArrayList<?>) masterMap
					.get(SWCalculationConstant.Billing_Period_Master);
			mDataService.enrichBillingPeriod(criteria, billingFrequencyMap, masterMap, criteria.getSewerageConnection().getConnectionType());

			Calculation calculation = null;
			if (request.getDisconnectRequest() != null) {
				if (request.getDisconnectRequest() &&
						criteria.getApplicationNo().equals(request.getCalculationCriteria().get(request.getCalculationCriteria().size() - 1)
								.getApplicationNo())) {
					calculation = getCalculation(request.getRequestInfo(), criteria, estimationMap, masterMap, true, true);
				}
			} else {
				calculation = getCalculation(request.getRequestInfo(), criteria, estimationMap, masterMap, true, false);
			}
			calculations.add(calculation);
		}
		return calculations;
	}

	/**
	 * 
	 * 
	 * @param request - Calculation Request
	 * @return List of calculation.
	 */
	public List<Calculation> bulkDemandGeneration(CalculationReq request, Map<String, Object> masterMap) {
		List<Calculation> calculations = getCalculations(request, masterMap);
		demandService.generateDemand(request.getRequestInfo(), calculations, masterMap, true);
		return calculations;
	}

	/**
	 * 
	 * @param request - Calculation Request
	 * @return list of calculation based on request
	 */
	public List<Calculation> getEstimation(CalculationReq request) {
		Map<String, Object> masterData = mDataService.loadExemptionMaster(request.getRequestInfo(),
				request.getCalculationCriteria().get(0).getTenantId());
		List<Calculation> calculations = getFeeCalculation(request, masterData);
		unsetSewerageConnection(calculations);
		return calculations;
	}

	/**
	 * 
	 * @param request - Calculation Request
	 * @param masterMap - MDMS Master Data
	 * @return list of calculation based on estimation criteria
	 */
	List<Calculation> getFeeCalculation(CalculationReq request, Map<String, Object> masterMap) {
		List<Calculation> calculations = new ArrayList<>(request.getCalculationCriteria().size());
		for (CalculationCriteria criteria : request.getCalculationCriteria()) {
			Map<String, List> estimationMap = estimationService.getFeeEstimation(criteria, request.getRequestInfo(),
					masterMap);
			mDataService.enrichBillingPeriodForFee(masterMap);
			Calculation calculation = getCalculation(request.getRequestInfo(), criteria, estimationMap, masterMap,
					false, false);
			calculations.add(calculation);
		}
		return calculations;
	}

	public void unsetSewerageConnection(List<Calculation> calculation) {
		calculation.forEach(cal -> cal.setSewerageConnection(null));
	}
	
	/**
	 * Add adhoc tax to demand
	 * @param adhocTaxReq - Adhoc Tax Request Object
	 * @return List of Calculation
	 */
	public List<Calculation> applyAdhocTax(AdhocTaxReq adhocTaxReq) {
		List<TaxHeadEstimate> estimates = new ArrayList<>();
		String businessService = adhocTaxReq.getBusinessService();
		if(!businessService.equalsIgnoreCase(SERVICE_FIELD_VALUE_SW) && !businessService.equalsIgnoreCase(ONE_TIME_FEE_SERVICE_FIELD))
			throw new CustomException("INVALID_BUSINESSSERVICE", "Provide businessService is invalid");

		if (!(adhocTaxReq.getAdhocpenalty().compareTo(BigDecimal.ZERO) == 0)){
			String penaltyTaxhead = businessService.equals(SERVICE_FIELD_VALUE_SW) ? SW_TIME_ADHOC_PENALTY : SW_ADHOC_PENALTY;
			estimates.add(TaxHeadEstimate.builder().taxHeadCode(penaltyTaxhead)
					.estimateAmount(adhocTaxReq.getAdhocpenalty().setScale(2, 2)).build());
		}
		if (!(adhocTaxReq.getAdhocrebate().compareTo(BigDecimal.ZERO) == 0)){
			String rebateTaxhead = businessService.equals(SERVICE_FIELD_VALUE_SW) ? SW_TIME_ADHOC_REBATE : SW_ADHOC_REBATE;
			estimates.add(TaxHeadEstimate.builder().taxHeadCode(rebateTaxhead)
					.estimateAmount(adhocTaxReq.getAdhocrebate().setScale(2, 2).negate()).build());
		}

		Calculation calculation = Calculation.builder()
				.tenantId(adhocTaxReq.getRequestInfo().getUserInfo().getTenantId())
				.connectionNo(adhocTaxReq.getConsumerCode()).taxHeadEstimates(estimates).build();
		List<Calculation> calculations = Collections.singletonList(calculation);
		return demandService.updateDemandForAdhocTax(adhocTaxReq.getRequestInfo(), calculations, businessService);
	}

}
