package org.egov.edcr.feature;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;
import org.egov.edcr.entity.blackbox.PlanDetail;
import org.kabeja.dxf.DXFBlock;
import org.kabeja.dxf.DXFConstants;
import org.kabeja.dxf.DXFDimension;
import org.kabeja.dxf.DXFDimensionStyle;
import org.kabeja.dxf.DXFDocument;
import org.kabeja.dxf.DXFEntity;
import org.kabeja.dxf.DXFLayer;
import org.kabeja.dxf.DXFMText;
import org.kabeja.dxf.DXFStyle;
import org.kabeja.dxf.DXFText;
import org.kabeja.dxf.helpers.StyledTextParagraph;
import org.springframework.stereotype.Service;

@Service
public class DxfFontExtract extends FeatureExtract {

    private static final Logger LOG = LogManager.getLogger(DxfFontExtract.class);

    @Override
    public PlanDetail extract(PlanDetail planDetail) {

        DXFDocument dxfDocument = planDetail.getDoc();
        Set<String> fontStylePresentInDxf = new HashSet<>();
        Set<String> fontStyleUsedInDxf = new HashSet<>();
        Set<String> dimensionStylePresentInDxf = new HashSet<>();
        Set<String> dimensionStyleUsedInDxf = new HashSet<>();

        Iterator dxfStyleIterator = dxfDocument.getDXFStyleIterator();
        while (dxfStyleIterator.hasNext()) {
            DXFStyle style = (DXFStyle) dxfStyleIterator.next();
            fontStylePresentInDxf.add(style.getName());
        }

        Iterator layerIterator = dxfDocument.getDXFLayerIterator();
        while (layerIterator.hasNext()) {
            DXFLayer layer = (DXFLayer) layerIterator.next();
            List texts = layer.getDXFEntities(DXFConstants.ENTITY_TYPE_TEXT);
            if (texts != null && !texts.isEmpty())
                getTextStyles(texts, fontStyleUsedInDxf);
            List mTexts = layer.getDXFEntities(DXFConstants.ENTITY_TYPE_MTEXT);
            if (mTexts != null && !mTexts.isEmpty())
                getMTextStyles(mTexts, fontStyleUsedInDxf);
            List dimensions = layer.getDXFEntities(DXFConstants.ENTITY_TYPE_DIMENSION);
            if (dimensions != null && !dimensions.isEmpty())
                getFontStyleForDimension(dxfDocument, dimensions, dimensionStyleUsedInDxf);
        }

        Iterator dimensionStyleIterator = dxfDocument.getDXFDimensionStyleIterator();
        while (dimensionStyleIterator.hasNext()) {
            DXFDimensionStyle style = (DXFDimensionStyle) dimensionStyleIterator.next();
            dimensionStylePresentInDxf.add(style.getName());
        }

        LOG.info("Styles in dxf : " + fontStylePresentInDxf);
        LOG.info("Styles used in dxf : " + fontStyleUsedInDxf);
        LOG.info("Dimension Styles in dxf : " + dimensionStylePresentInDxf);
        LOG.info("Dimension Styles used in dxf : " + dimensionStyleUsedInDxf);

        return planDetail;
    }

    @Override
    public PlanDetail validate(PlanDetail planDetail) {
        return planDetail;
    }

    private void getTextStyles(List texts, Set<String> fontStyleUsedInDxf) {

        if (texts != null && !texts.isEmpty()) {
            Iterator iterator = texts.iterator();
            while (iterator.hasNext()) {
                DXFText text = (DXFText) iterator.next();
                fontStyleUsedInDxf.add(text.getTextStyle());
                Iterator styledParagraphIterator = text.getTextDocument().getStyledParagraphIterator();
                while (styledParagraphIterator.hasNext()) {
                    StyledTextParagraph styledTextParagraph = (StyledTextParagraph) styledParagraphIterator.next();
                    // LOG.info("Text paragraph fonts : " +
                    // styledTextParagraph.getFont());
                    fontStyleUsedInDxf.add(styledTextParagraph.getFont());

                }
            }
        }
    }

    private void getMTextStyles(List mTexts, Set<String> fontStyleUsedInDxf) {

        if (mTexts != null && !mTexts.isEmpty()) {
            Iterator iterator = mTexts.iterator();
            while (iterator.hasNext()) {
                DXFMText mText = (DXFMText) iterator.next();
                // LOG.info("Mtext styles : " + mText.getTextStyle());
                fontStyleUsedInDxf.add(mText.getTextStyle());

                Iterator styledParagraphIterator = mText.getTextDocument().getStyledParagraphIterator();
                while (styledParagraphIterator.hasNext()) {
                    StyledTextParagraph styledTextParagraph = (StyledTextParagraph) styledParagraphIterator.next();
                    // LOG.info("MTEXT paragraph fonts : " +
                    fontStyleUsedInDxf.add(styledTextParagraph.getFont());
                }
            }
        }
    }

    private void getFontStyleForDimension(DXFDocument dxfDocument, List dimensions,
            Set<String> dimensionStyleUsedInDxf) {

        if (dimensions != null && !dimensions.isEmpty()) {
            Iterator iterator = dimensions.iterator();
            List mTexts = new ArrayList<>();

            while (iterator.hasNext()) {
                DXFDimension dimension = (DXFDimension) iterator.next();
                String dimensionBlock = dimension.getDimensionBlock();
                DXFBlock dxfBlock = dxfDocument.getDXFBlock(dimensionBlock);
                Iterator entitiesIterator = dxfBlock.getDXFEntitiesIterator();
                while (entitiesIterator.hasNext()) {
                    DXFEntity e = (DXFEntity) entitiesIterator.next();

                    if (e.getType().equals(DXFConstants.ENTITY_TYPE_MTEXT)) {
                        DXFMText dxfmText = (DXFMText) e;
                        mTexts.add(dxfmText);
                    }
                }
            }

            if (!mTexts.isEmpty()) {
                Iterator mTextIterator = mTexts.iterator();
                while (mTextIterator.hasNext()) {
                    DXFMText mText = (DXFMText) mTextIterator.next();
                    // LOG.info("Dimension Mtext styles : " + mText.getTextStyle());
                    dimensionStyleUsedInDxf.add(mText.getTextStyle());
                    Iterator styledParagraphIterator = mText.getTextDocument().getStyledParagraphIterator();
                    while (styledParagraphIterator.hasNext()) {
                        StyledTextParagraph styledTextParagraph = (StyledTextParagraph) styledParagraphIterator.next();
                        // LOG.info("Dimension Mtext paragraph fonts : " +
                        dimensionStyleUsedInDxf.add(styledTextParagraph.getFont());
                    }
                }
            }

        }
    }

}
