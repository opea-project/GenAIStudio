import { useState, useEffect } from 'react';
import { getBezierPath, EdgeText } from 'reactflow';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { useContext } from 'react';
import { SET_DIRTY } from '@/store/actions';
import { flowContext } from '@/store/context/ReactFlowContext';
import './index.css';

const foreignObjectSize = 40;

const ButtonEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    data,
}) => {
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setIsAnimating(false);
        }, 1000);
        return () => clearTimeout(timeout);
    }, []);

    const [edgePath, edgeCenterX, edgeCenterY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const { deleteEdge } = useContext(flowContext);
    const dispatch = useDispatch();

    const onEdgeClick = (evt, id) => {
        evt.stopPropagation();
        deleteEdge(id);
        dispatch({ type: SET_DIRTY });
    };

    const markerEnd = 'url(#arrow)';
    return (
        <>
            <defs>
                <marker
                    id="arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                >
                    <path d="M0,0 L0,6 L9,3 z" fill="#000" />
                </marker>
            </defs>

            <path
                id={id}
                style={style}
                className={`react-flow__edge-path ${isAnimating ? 'animated' : ''}`}
                d={edgePath}
                markerEnd={markerEnd}
            />

            {data && data.label && (
                <EdgeText
                    x={sourceX + 10}
                    y={sourceY + 10}
                    label={data.label}
                    labelStyle={{ fill: 'black' }}
                    labelBgStyle={{ fill: 'transparent' }}
                    labelBgPadding={[2, 4]}
                    labelBgBorderRadius={2}
                />
            )}

            <foreignObject
                width={foreignObjectSize}
                height={foreignObjectSize}
                x={edgeCenterX - foreignObjectSize / 2}
                y={edgeCenterY - foreignObjectSize / 2}
                className='edgebutton-foreignobject'
                requiredExtensions='http://www.w3.org/1999/xhtml'
            >
                <div>
                    <button className='edgebutton' onClick={(event) => onEdgeClick(event, id)}>
                        ×
                    </button>
                </div>
            </foreignObject>
        </>
    );
};

ButtonEdge.propTypes = {
    id: PropTypes.string,
    sourceX: PropTypes.number,
    sourceY: PropTypes.number,
    targetX: PropTypes.number,
    targetY: PropTypes.number,
    sourcePosition: PropTypes.any,
    targetPosition: PropTypes.any,
    style: PropTypes.object,
    data: PropTypes.object,
};

export default ButtonEdge;